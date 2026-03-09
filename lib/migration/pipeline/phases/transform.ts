// Phase 5: Transform — Apply approved MappingSpec to produce canonical staging records
// Includes post-transform AI enrichment: form classification, field inference, semantic classification

import { createHash } from "crypto";
import type { ArtifactStore, ArtifactRef } from "../../storage/types";
import type { MappingSpec } from "../../canonical/mapping-spec";
import type {
  CanonicalRecord,
  CanonicalEntityType,
  CanonicalChart,
  CanonicalConsent,
  CanonicalChartTemplateField,
} from "../../canonical/schema";
import type { FormFieldContent } from "../../providers/types";
import type { FieldSemanticEntry } from "@/lib/agents/migration/field-classification";
import { createAdapter } from "../../adapters";
import { classifyForms } from "@/lib/agents/migration/classification";
import { analyzeFields } from "@/lib/agents/migration/field-analysis";
import { getVendorKnowledge } from "@/lib/agents/migration/vendor-knowledge";

export interface TransformInput {
  runId: string;
  vendor: string;
  tenantId: string;
  artifacts: ArtifactRef[];
  mappingSpec: MappingSpec;
}

export interface TransformResult {
  records: Array<{
    entityType: CanonicalEntityType;
    canonicalId: string;
    record: CanonicalRecord;
    checksum: string;
    sourceRecordId: string;
  }>;
  counts: Record<string, number>;
}

export async function executeTransform(
  input: TransformInput,
  store: ArtifactStore
): Promise<TransformResult> {
  const adapter = createAdapter(input.vendor, input.tenantId);
  const results: TransformResult["records"] = [];
  const counts: Record<string, number> = {};

  for await (const { entityType, record } of adapter.transform(
    input.artifacts,
    store,
    input.mappingSpec
  )) {
    const canonical = record as unknown as Record<string, unknown>;
    const canonicalId = canonical.canonicalId as string;
    const sourceRecordId = canonical.sourceRecordId as string;
    const checksum = createHash("sha256")
      .update(JSON.stringify(record))
      .digest("hex");

    results.push({
      entityType,
      canonicalId,
      record,
      checksum,
      sourceRecordId,
    });

    counts[entityType] = (counts[entityType] || 0) + 1;
  }

  // Post-transform: AI classification for form/consent records
  await enrichFormsWithClassification(results, counts, input.vendor, store, input);

  return { records: results, counts };
}

// --- Post-transform AI enrichment ---

/**
 * Classify forms/consents using AI and enrich canonical records:
 * - clinical_chart → convert to CanonicalChart with template metadata
 * - consent/intake → keep as CanonicalConsent
 * - skip → remove from results
 *
 * Also runs field inference and semantic classification on clinical charts
 * to generate template fields and filter demographics.
 */
async function enrichFormsWithClassification(
  results: TransformResult["records"],
  counts: Record<string, number>,
  vendor: string,
  store: ArtifactStore,
  input: TransformInput
): Promise<void> {
  // Collect consent/form records that might need reclassification
  const formRecords = results.filter(
    (r) => r.entityType === "consent"
  );

  if (formRecords.length === 0) return;

  const vendorKnowledge = getVendorKnowledge(vendor);

  // Load raw form data from artifacts for classification context
  const formsArtifact = input.artifacts.find((a) => a.key === "forms.json");
  let rawForms: Array<{
    sourceId: string;
    templateName: string;
    templateId?: string;
    status?: string;
    isInternal?: boolean;
    submittedByRole?: string;
    fields?: FormFieldContent[];
  }> = [];

  if (formsArtifact) {
    try {
      const data = await store.get(formsArtifact);
      rawForms = JSON.parse(data.toString("utf-8"));
    } catch {
      // No raw forms available — skip classification
      return;
    }
  }

  if (rawForms.length === 0) return;

  // Build form objects for classification
  const formsForClassification = rawForms.map((f) => ({
    sourceId: f.sourceId,
    patientSourceId: "", // Not needed for classification
    templateName: f.templateName || "Unknown",
    templateId: f.templateId,
    status: f.status || "completed",
    isInternal: f.isInternal ?? false,
    submittedByRole: f.submittedByRole as "staff" | "client" | undefined,
    fields: f.fields,
    submittedAt: undefined as string | undefined,
    submittedByName: undefined as string | undefined,
    expirationDate: undefined as string | undefined,
    appointmentSourceId: undefined as string | undefined,
    rawData: undefined as unknown as Record<string, unknown>,
  }));

  // Run AI classification
  const classification = await classifyForms(formsForClassification, vendorKnowledge);
  const classMap = new Map(
    classification.classifications.map((c) => [c.formSourceId, c])
  );

  // Build field unions per template for chart template generation
  const templateFieldUnions = new Map<string, {
    name: string;
    fields: Map<string, FormFieldContent>;
  }>();

  for (const form of rawForms) {
    if (!form.templateId || !form.fields) continue;
    let entry = templateFieldUnions.get(form.templateId);
    if (!entry) {
      entry = { name: form.templateName || "Unknown", fields: new Map() };
      templateFieldUnions.set(form.templateId, entry);
    }
    for (const field of form.fields) {
      if (!entry.fields.has(field.fieldId)) {
        entry.fields.set(field.fieldId, field);
      }
    }
  }

  // Combined field analysis per template (type inference + semantic classification in one AI call)
  const inferredTypesByTemplate = new Map<string, Map<string, string>>();
  const classificationsByTemplate = new Map<string, Map<string, FieldSemanticEntry>>();

  // Determine which templates need AI processing
  const clinicalTemplateIds = new Set<string>();
  for (const form of rawForms) {
    if (!form.templateId) continue;
    const cls = classMap.get(form.sourceId);
    if (cls?.classification === "clinical_chart") {
      clinicalTemplateIds.add(form.templateId);
    }
  }

  for (const templateId of clinicalTemplateIds) {
    const tmpl = templateFieldUnions.get(templateId);
    if (!tmpl) continue;

    try {
      const { types, semantics } = await analyzeFields(tmpl.name, tmpl.fields, vendorKnowledge);
      inferredTypesByTemplate.set(templateId, types as Map<string, string>);
      classificationsByTemplate.set(templateId, semantics);
    } catch {
      // Heuristic fallback handled internally by analyzeFields
    }
  }

  // Now reclassify each consent record
  const toRemove = new Set<number>();

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.entityType !== "consent") continue;

    const consent = result.record as unknown as CanonicalConsent;
    const sourceId = consent.sourceRecordId;

    // Find the raw form for this consent
    const rawForm = rawForms.find((f) => f.sourceId === sourceId);
    if (!rawForm) continue;

    const cls = classMap.get(sourceId);
    if (!cls) continue;

    if (cls.classification === "skip") {
      toRemove.add(i);
      counts["consent"] = (counts["consent"] || 0) - 1;
      continue;
    }

    if (cls.classification === "clinical_chart") {
      // Convert consent → chart
      const templateId = rawForm.templateId;
      const tmplFields = templateId ? templateFieldUnions.get(templateId) : undefined;
      const fieldInferences = templateId ? inferredTypesByTemplate.get(templateId) : undefined;
      const fieldClassifications = templateId ? classificationsByTemplate.get(templateId) : undefined;

      // Build template fields (filtered by classification)
      const chartTemplateFields: CanonicalChartTemplateField[] = [];
      const templateValues: Record<string, string> = {};
      const sourceFormFields: CanonicalChart["sourceFormFields"] = [];
      const seenFieldKeys = new Set<string>();

      if (tmplFields && rawForm.fields) {
        // Sort template fields by source form layout order
        const sortedFields = Array.from(tmplFields.fields.entries()).sort(
          ([, a], [, b]) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity)
        );
        for (const [fieldId, field] of sortedFields) {
          const semCls = fieldClassifications?.get(fieldId);

          // Skip demographics and admin
          if (semCls?.category === "patient_demographic") continue;
          if (semCls?.category === "administrative") continue;

          const fieldKey = semCls?.templateKey
            ?? generateTemplateKey(field.label)
            ?? `field_${fieldId}`;
          const fieldType = fieldInferences?.get(fieldId) ?? mapFieldType(field.type);

          if (seenFieldKeys.has(fieldKey)) continue;
          seenFieldKeys.add(fieldKey);

          chartTemplateFields.push({
            key: fieldKey,
            label: field.label,
            type: fieldType,
            options: field.availableOptions?.length ? field.availableOptions : undefined,
          });

          // Track source form fields for patient enrichment
          sourceFormFields.push({
            fieldId,
            label: field.label,
            value: field.value ?? undefined,
            selectedOptions: field.selectedOptions,
            type: field.type,
            connectedFieldName: field.connectedFieldName ?? undefined,
            category: semCls?.category,
            patientField: semCls?.patientField,
          });
        }

        // Build template values from this specific form submission
        for (const field of rawForm.fields) {
          const semCls = fieldClassifications?.get(field.fieldId);
          if (semCls?.category === "patient_demographic") continue;
          if (semCls?.category === "administrative") continue;
          if (field.type === "heading") continue;

          const fieldKey = semCls?.templateKey
            ?? generateTemplateKey(field.label)
            ?? `field_${field.fieldId}`;

          if (field.selectedOptions?.length) {
            templateValues[fieldKey] = field.selectedOptions.join(", ");
          } else if (field.value) {
            templateValues[fieldKey] = field.value;
          }
        }
      }

      // Create chart record replacing the consent
      const chart: CanonicalChart = {
        canonicalId: consent.canonicalId,
        sourceRecordId: consent.sourceRecordId,
        canonicalPatientId: consent.canonicalPatientId,
        providerName: consent.signedByName || "",
        chiefComplaint: rawForm.templateName,
        sections: [],
        signedAt: consent.signedAt,
        templateName: rawForm.templateName,
        templateFields: chartTemplateFields.length > 0 ? chartTemplateFields : undefined,
        templateValues: Object.keys(templateValues).length > 0 ? templateValues : undefined,
        sourceFormFields: sourceFormFields.length > 0 ? sourceFormFields : undefined,
      };

      // Replace in results
      results[i] = {
        entityType: "chart",
        canonicalId: consent.canonicalId,
        record: chart,
        checksum: createHash("sha256").update(JSON.stringify(chart)).digest("hex"),
        sourceRecordId: consent.sourceRecordId,
      };

      counts["consent"] = (counts["consent"] || 0) - 1;
      counts["chart"] = (counts["chart"] || 0) + 1;
    }
    // consent/intake stay as-is
  }

  // Remove skipped records (iterate in reverse to preserve indices)
  const removeIndices = [...toRemove].sort((a, b) => b - a);
  for (const idx of removeIndices) {
    results.splice(idx, 1);
  }
}

// --- Helpers ---

function generateTemplateKey(label: string): string | null {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("_");
  return key || null;
}

export function mapFieldType(sourceType: string): string {
  switch (sourceType) {
    case "heading": return "heading";
    case "text":
    case "connected_text": return "text";
    case "textarea": return "textarea";
    case "checkbox": return "checklist";
    case "date":
    case "connected_date": return "date";
    case "dropdown":
    case "select":
    case "radio": return "select";
    case "signature": return "signature";
    case "image": return "photo-single";
    default: return "text";
  }
}
