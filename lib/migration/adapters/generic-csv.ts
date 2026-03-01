// GenericCSVAdapter — profiles and transforms CSV/JSON artifact files
// Supports multiple CSV files, entity hinting via manifest, type inference

import { createHash } from "crypto";
import type { ArtifactRef } from "../storage/types";
import type { ArtifactStore } from "../storage/types";
import type { MappingSpec } from "../canonical/mapping-spec";
import type { CanonicalRecord, CanonicalEntityType } from "../canonical/schema";
import type { VendorAdapter, SourceProfile, SourceEntityProfile, SourceFieldProfile, RelationshipHint } from "./types";
import { executeTransform } from "../canonical/transforms";
import type { AllowedTransform } from "../canonical/transforms";

// PHI field name heuristics
const PHI_FIELD_PATTERNS = [
  /^(first|last|middle|full)?_?name$/i,
  /^(f|l|m)name$/i,
  /email/i,
  /phone/i,
  /\b(dob|date_?of_?birth|birth_?date|birthday)\b/i,
  /\bssn\b/i,
  /social_?security/i,
  /address/i,
  /\bcity\b/i,
  /\bstate\b/i,
  /\bzip/i,
  /\bpostal/i,
  /\b(mrn|medical_?record)\b/i,
  /\binsurance/i,
  /\bpolicy/i,
  /\ballerg/i,
  /\bmedication/i,
  /\bdiagnos/i,
];

function isPHIField(fieldName: string): boolean {
  return PHI_FIELD_PATTERNS.some((p) => p.test(fieldName));
}

// Type inference heuristics
const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s()-]{7,15}$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

function inferType(values: string[]): SourceFieldProfile["inferredType"] {
  const nonEmpty = values.filter((v) => v !== "" && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return "unknown";

  const sample = nonEmpty.slice(0, 100);
  const checks: Array<{ type: SourceFieldProfile["inferredType"]; test: (v: string) => boolean }> = [
    { type: "email", test: (v) => EMAIL_RE.test(v) },
    { type: "phone", test: (v) => PHONE_RE.test(v) && v.replace(/\D/g, "").length >= 7 },
    { type: "date", test: (v) => DATE_RE.test(v) },
    { type: "number", test: (v) => NUMBER_RE.test(v) },
    { type: "boolean", test: (v) => ["true", "false", "yes", "no", "0", "1"].includes(v.toLowerCase()) },
  ];

  for (const check of checks) {
    const matchRate = sample.filter(check.test).length / sample.length;
    if (matchRate >= 0.8) return check.type;
  }

  // Check if enum (low cardinality)
  const unique = new Set(sample);
  if (unique.size <= 20 && sample.length >= 5) return "enum";

  return "string";
}

// Simple CSV parser (handles quoted fields)
function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && (i === 0 || line[i - 1] !== "\\")) {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

// Generate canonical ID deterministically
function generateCanonicalId(tenantId: string, vendorKey: string, sourceId: string): string {
  return createHash("sha256")
    .update(`${tenantId}:${vendorKey}:${sourceId}`)
    .digest("hex")
    .substring(0, 24);
}

// Guess entity type from filename/artifact key
function guessEntityType(key: string): string {
  const lower = key.toLowerCase().replace(/\.(csv|json)$/i, "");
  const mappings: Record<string, string> = {
    patients: "patients", patient: "patients", clients: "patients", client: "patients",
    appointments: "appointments", appointment: "appointments", bookings: "appointments",
    charts: "charts", chart: "charts", clinical_notes: "charts",
    invoices: "invoices", invoice: "invoices", orders: "invoices",
    photos: "photos", photo: "photos", images: "photos",
    documents: "documents", document: "documents", files: "documents",
    consents: "consents", consent: "consents",
    encounters: "encounters", encounter: "encounters",
  };
  return mappings[lower] || lower;
}

export class GenericCSVAdapter implements VendorAdapter {
  private tenantId: string;
  private vendorKey: string;

  constructor(tenantId: string, vendorKey: string = "csv") {
    this.tenantId = tenantId;
    this.vendorKey = vendorKey;
  }

  async profile(artifacts: ArtifactRef[], store: ArtifactStore): Promise<SourceProfile> {
    const entities: SourceEntityProfile[] = [];
    const phiClassification: Record<string, Record<string, boolean>> = {};

    for (const artifact of artifacts) {
      // Skip non-data files
      if (artifact.key.endsWith(".meta.json")) continue;

      const data = await store.get(artifact);
      const content = data.toString("utf-8");

      let entityProfile: SourceEntityProfile;

      if (artifact.key.endsWith(".json")) {
        entityProfile = this.profileJSON(artifact.key, content);
      } else {
        entityProfile = this.profileCSV(artifact.key, content);
      }

      entities.push(entityProfile);

      // Build PHI classification
      const fieldPhi: Record<string, boolean> = {};
      for (const field of entityProfile.fields) {
        fieldPhi[field.name] = field.isPHI;
      }
      phiClassification[entityProfile.type] = fieldPhi;
    }

    return { entities, phiClassification };
  }

  private profileCSV(key: string, content: string): SourceEntityProfile {
    const { headers, rows } = parseCSV(content);
    const entityType = guessEntityType(key);
    const fields: SourceFieldProfile[] = [];
    const keyCandidates: string[] = [];
    const relationshipHints: RelationshipHint[] = [];

    for (let col = 0; col < headers.length; col++) {
      const name = headers[col];
      const values = rows.map((r) => r[col] || "");
      const nonEmpty = values.filter((v) => v !== "");
      const unique = new Set(nonEmpty);

      const nullRate = 1 - nonEmpty.length / Math.max(values.length, 1);
      const uniqueRate = unique.size / Math.max(nonEmpty.length, 1);

      const inferredType = inferType(values);

      fields.push({
        name,
        inferredType,
        nullRate: Math.round(nullRate * 100) / 100,
        uniqueRate: Math.round(uniqueRate * 100) / 100,
        sampleDistribution: `${nonEmpty.length}/${values.length} non-null, ${unique.size} unique`,
        isPHI: isPHIField(name),
      });

      // Key candidates: high uniqueness, low null rate
      if (uniqueRate > 0.95 && nullRate < 0.05) {
        keyCandidates.push(name);
      }

      // Relationship hints
      if (/(_id|Id|_key)$/i.test(name)) {
        const target = name.replace(/(_id|Id|_key)$/i, "").toLowerCase();
        const targetEntity = target === "patient" || target === "client" ? "patients" : `${target}s`;
        relationshipHints.push({
          field: name,
          targetEntity,
          targetField: "id",
          confidence: 0.7,
        });
      }
    }

    return {
      type: entityType,
      source: key,
      recordCount: rows.length,
      fields,
      keyCandidates,
      relationshipHints,
    };
  }

  private profileJSON(key: string, content: string): SourceEntityProfile {
    const parsed = JSON.parse(content);
    const records: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed];
    const entityType = guessEntityType(key);

    // Collect all unique field names
    const fieldNames = new Set<string>();
    for (const record of records) {
      for (const k of Object.keys(record)) {
        fieldNames.add(k);
      }
    }

    const fields: SourceFieldProfile[] = [];
    const keyCandidates: string[] = [];
    const relationshipHints: RelationshipHint[] = [];

    for (const name of fieldNames) {
      const values = records.map((r) => {
        const v = r[name];
        return v === null || v === undefined ? "" : String(v);
      });
      const nonEmpty = values.filter((v) => v !== "");
      const unique = new Set(nonEmpty);

      const nullRate = 1 - nonEmpty.length / Math.max(values.length, 1);
      const uniqueRate = unique.size / Math.max(nonEmpty.length, 1);
      const inferredType = inferType(values);

      fields.push({
        name,
        inferredType,
        nullRate: Math.round(nullRate * 100) / 100,
        uniqueRate: Math.round(uniqueRate * 100) / 100,
        sampleDistribution: `${nonEmpty.length}/${values.length} non-null, ${unique.size} unique`,
        isPHI: isPHIField(name),
      });

      if (uniqueRate > 0.95 && nullRate < 0.05) keyCandidates.push(name);
      if (/(_id|Id|_key)$/i.test(name)) {
        const target = name.replace(/(_id|Id|_key)$/i, "").toLowerCase();
        const targetEntity = target === "patient" || target === "client" ? "patients" : `${target}s`;
        relationshipHints.push({ field: name, targetEntity, targetField: "id", confidence: 0.7 });
      }
    }

    return {
      type: entityType,
      source: key,
      recordCount: records.length,
      fields,
      keyCandidates,
      relationshipHints,
    };
  }

  async *transform(
    artifacts: ArtifactRef[],
    store: ArtifactStore,
    mappingSpec: MappingSpec
  ): AsyncGenerator<{ entityType: CanonicalEntityType; record: CanonicalRecord }> {
    for (const artifact of artifacts) {
      if (artifact.key.endsWith(".meta.json")) continue;

      const data = await store.get(artifact);
      const content = data.toString("utf-8");
      const entityKey = guessEntityType(artifact.key);

      // Find matching entity mapping
      const entityMapping = mappingSpec.entityMappings.find(
        (em) => em.sourceEntity === entityKey || em.sourceEntity === artifact.key
      );
      if (!entityMapping) continue;

      let records: Record<string, unknown>[];

      if (artifact.key.endsWith(".json")) {
        const parsed = JSON.parse(content);
        records = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        const { headers, rows } = parseCSV(content);
        records = rows.map((row) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = row[i] || ""; });
          return obj;
        });
      }

      for (const srcRecord of records) {
        const canonical: Record<string, unknown> = {};

        // Find sourceRecordId from key candidates or first unique field
        const idField = entityMapping.fieldMappings.find(
          (fm) => fm.targetField === "sourceRecordId"
        );
        const sourceRecordId = idField
          ? String(srcRecord[idField.sourceField] || "")
          : String(srcRecord["id"] || srcRecord["sourceId"] || Math.random().toString(36).substring(7));

        canonical.canonicalId = generateCanonicalId(
          this.tenantId,
          mappingSpec.sourceVendor,
          sourceRecordId
        );
        canonical.sourceRecordId = sourceRecordId;

        // Apply field mappings
        for (const fm of entityMapping.fieldMappings) {
          if (fm.targetField === "sourceRecordId" || fm.targetField === "canonicalId") continue;

          let value = srcRecord[fm.sourceField];

          if (fm.transform) {
            const enumMap = entityMapping.enumMaps[fm.sourceField];
            value = executeTransform(fm.transform as AllowedTransform, value as string, {
              enumMap,
              ...(fm.transformContext as Record<string, unknown> || {}),
            });
          }

          canonical[fm.targetField] = value;
        }

        yield {
          entityType: entityMapping.targetEntity,
          record: canonical as CanonicalRecord,
        };
      }
    }
  }
}
