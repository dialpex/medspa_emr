// Enhanced form classification with two-phase pre-filter + AI.

import type { SourceForm, FormFieldContent } from "@/lib/migration/providers/types";
import type { FormClassificationResponse } from "@/lib/agents/migration/legacy/agent-schemas";
import type { VendorKnowledge } from "../vendor-knowledge";
import { getLLMProvider } from "@/lib/agents/_shared/llm";
import { completionWithRetry } from "@/lib/agents/_shared/llm/self-healing";
import {
  HIGH_CONFIDENCE_PATTERNS,
  CLINICAL_FIELD_INDICATORS,
  ENHANCED_CLASSIFICATION_SYSTEM_PROMPT,
  buildClassificationVendorContext,
} from "./prompts";

type FormWithFields = SourceForm & { fields?: FormFieldContent[] };
type Classification = FormClassificationResponse["classifications"][number];

/**
 * Check if a form has clinical field indicators (units, injection site, etc.)
 */
function hasClinicalFields(fields?: FormFieldContent[]): boolean {
  if (!fields || fields.length === 0) return false;
  return fields.some((f) =>
    CLINICAL_FIELD_INDICATORS.some((pattern) => pattern.test(f.label))
  );
}

/**
 * Build chart data from form fields for clinical_chart classification.
 */
function buildChartData(form: FormWithFields): Classification["chartData"] {
  const dataFields =
    form.fields?.filter(
      (f) => f.type !== "heading" && f.type !== "signature" && f.type !== "image"
    ) || [];

  const narrativeLines: string[] = [];
  for (const fld of dataFields) {
    if (!fld.value && (!fld.selectedOptions || fld.selectedOptions.length === 0)) continue;
    const val = fld.selectedOptions?.length
      ? fld.selectedOptions.join(", ")
      : fld.value || "";
    if (val) narrativeLines.push(`${fld.label}: ${val}`);
  }

  return {
    chiefComplaint: form.templateName,
    templateType: "Other" as const,
    treatmentCardTitle: form.templateName,
    narrativeText: narrativeLines.join("\n"),
    structuredData: {},
  };
}

/**
 * Heuristic classification — identical logic to legacy classifyAndMapForms mock.
 */
function heuristicClassify(form: FormWithFields): Classification {
  const name = form.templateName.toLowerCase();

  if (form.isInternal && !name.includes("chart") && !name.includes("treatment")) {
    return {
      formSourceId: form.sourceId,
      classification: "skip",
      confidence: 0.8,
      reasoning: "Internal admin form",
      chartData: null,
    };
  }

  if (
    name.includes("consent") ||
    name.includes("waiver") ||
    name.includes("agreement") ||
    name.includes("policy") ||
    name.includes("authorization") ||
    name.includes("instructions")
  ) {
    return {
      formSourceId: form.sourceId,
      classification: "consent",
      confidence: 0.9,
      reasoning: `Template name "${form.templateName}" matches consent pattern`,
      chartData: null,
    };
  }

  if (
    name.includes("intake") ||
    name.includes("history") ||
    name.includes("questionnaire") ||
    name.includes("survey") ||
    name.includes("registration")
  ) {
    return {
      formSourceId: form.sourceId,
      classification: "intake",
      confidence: 0.85,
      reasoning: `Template name "${form.templateName}" matches intake pattern`,
      chartData: null,
    };
  }

  if (
    name.includes("chart") ||
    name.includes("treatment") ||
    name.includes("procedure") ||
    name.includes("clinical") ||
    name.includes("assessment")
  ) {
    return {
      formSourceId: form.sourceId,
      classification: "clinical_chart",
      confidence: 0.75,
      reasoning: `Template name "${form.templateName}" matches clinical chart pattern`,
      chartData: buildChartData(form),
    };
  }

  // Default: treat as consent
  return {
    formSourceId: form.sourceId,
    classification: "consent",
    confidence: 0.6,
    reasoning: `No clear pattern match for "${form.templateName}" — defaulting to consent`,
    chartData: null,
  };
}

/**
 * Phase 1: Pre-filter — classify forms that can be determined without AI.
 * Returns [preFiltered, remaining] where preFiltered are resolved and
 * remaining need AI classification.
 */
function preFilter(
  forms: FormWithFields[]
): [Classification[], FormWithFields[]] {
  const resolved: Classification[] = [];
  const remaining: FormWithFields[] = [];

  for (const form of forms) {
    // Skip internal non-clinical forms
    if (
      form.isInternal &&
      !form.templateName.toLowerCase().includes("chart") &&
      !form.templateName.toLowerCase().includes("treatment") &&
      !form.templateName.toLowerCase().includes("clinical") &&
      !hasClinicalFields(form.fields)
    ) {
      resolved.push({
        formSourceId: form.sourceId,
        classification: "skip",
        confidence: 0.9,
        reasoning: "Internal admin form — skipped without AI",
        chartData: null,
      });
      continue;
    }

    // Check high-confidence keyword patterns
    let matched = false;
    for (const { pattern, classification, confidence } of HIGH_CONFIDENCE_PATTERNS) {
      if (pattern.test(form.templateName)) {
        if (classification === "clinical_chart") {
          resolved.push({
            formSourceId: form.sourceId,
            classification,
            confidence,
            reasoning: `Template name "${form.templateName}" matches high-confidence clinical pattern`,
            chartData: buildChartData(form),
          });
        } else {
          resolved.push({
            formSourceId: form.sourceId,
            classification,
            confidence,
            reasoning: `Template name "${form.templateName}" matches high-confidence pattern`,
            chartData: null,
          });
        }
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Check if field content indicates clinical_chart regardless of name
    if (hasClinicalFields(form.fields)) {
      resolved.push({
        formSourceId: form.sourceId,
        classification: "clinical_chart",
        confidence: 0.88,
        reasoning: `Form "${form.templateName}" has clinical field indicators (units, injection site, device, etc.)`,
        chartData: buildChartData(form),
      });
      continue;
    }

    remaining.push(form);
  }

  return [resolved, remaining];
}

/**
 * Build PHI-safe form metadata for AI classification (no patient values).
 */
function buildFormMetadata(form: FormWithFields) {
  return {
    sourceId: form.sourceId,
    templateName: form.templateName,
    status: form.status,
    isInternal: form.isInternal,
    submittedByRole: form.submittedByRole,
    fieldLabels: form.fields?.map((f) => ({
      label: f.label,
      type: f.type,
      optionCount: f.availableOptions?.length ?? 0,
    })),
  };
}

/**
 * Classify forms using a two-phase approach:
 * 1. Pre-filter: resolve unambiguous forms without AI (free)
 * 2. AI classification: send remaining ambiguous forms to LLM
 *
 * Falls back to full heuristic classification when no LLM is available.
 * Same return type as legacy classifyAndMapForms for drop-in replacement.
 */
export async function classifyForms(
  forms: FormWithFields[],
  vendorKnowledge?: VendorKnowledge | null
): Promise<FormClassificationResponse> {
  if (forms.length === 0) {
    return { classifications: [] };
  }

  // Phase 1: Pre-filter
  const [preFiltered, remaining] = preFilter(forms);

  // If everything was resolved in pre-filter, return early
  if (remaining.length === 0) {
    return { classifications: preFiltered };
  }

  const provider = getLLMProvider();

  // If no real LLM available (mock provider or unavailable), use heuristic fallback for remaining
  if (provider.name === "mock" || !provider.isAvailable()) {
    const heuristicResults = remaining.map(heuristicClassify);
    return { classifications: [...preFiltered, ...heuristicResults] };
  }

  // Phase 2: AI classification for ambiguous forms
  const vendorContext = buildClassificationVendorContext(vendorKnowledge?.classificationHints);
  const system = ENHANCED_CLASSIFICATION_SYSTEM_PROMPT.replace("{vendorContext}", vendorContext);

  const formMetadata = remaining.map(buildFormMetadata);
  const userMessage = `Classify these ${remaining.length} forms from a MedSpa migration:\n\n${JSON.stringify(formMetadata, null, 2)}`;

  try {
    const { result: aiResult } = await completionWithRetry<FormClassificationResponse>(
      provider,
      system,
      userMessage,
      { temperature: 0.2, maxTokens: 4096 },
      (parsed) => {
        if (!parsed.classifications || !Array.isArray(parsed.classifications)) {
          return { valid: false, error: "Response must have a 'classifications' array." };
        }
        const validTypes = new Set(["consent", "clinical_chart", "intake", "skip"]);
        const invalid = parsed.classifications.filter(
          (c) => !validTypes.has(c.classification)
        );
        if (invalid.length > 0) {
          return {
            valid: false,
            error: `Invalid classifications: ${invalid.map((c) => `${c.formSourceId}: "${c.classification}"`).join(", ")}. Must be one of: consent, clinical_chart, intake, skip`,
          };
        }
        return { valid: true };
      }
    );

    // Build chart data for any clinical_chart classifications from AI
    // that need chart data populated
    const aiClassifications = aiResult.classifications.map((cls) => {
      if (cls.classification === "clinical_chart" && !cls.chartData) {
        const form = remaining.find((f) => f.sourceId === cls.formSourceId);
        if (form) {
          return { ...cls, chartData: buildChartData(form) };
        }
      }
      return cls;
    });

    // Merge pre-filtered + AI results, with heuristic fallback for any
    // forms that AI missed
    const aiMap = new Map(aiClassifications.map((c) => [c.formSourceId, c]));
    const aiResults: Classification[] = [];
    for (const form of remaining) {
      const aiCls = aiMap.get(form.sourceId);
      if (aiCls) {
        aiResults.push(aiCls);
      } else {
        aiResults.push(heuristicClassify(form));
      }
    }

    return { classifications: [...preFiltered, ...aiResults] };
  } catch (err) {
    // Full AI failure — fall back to heuristics for remaining forms
    console.warn(
      `[classification] AI failed, using heuristic fallback: ${err instanceof Error ? err.message : String(err)}`
    );
    const heuristicResults = remaining.map(heuristicClassify);
    return { classifications: [...preFiltered, ...heuristicResults] };
  }
}
