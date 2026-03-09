// Enhanced AI prompt for form classification during migration.

/**
 * High-confidence keyword patterns for heuristic pre-filter.
 * These bypass AI entirely for unambiguous forms.
 */
export const HIGH_CONFIDENCE_PATTERNS: Array<{
  pattern: RegExp;
  classification: "consent" | "clinical_chart" | "intake" | "skip";
  confidence: number;
}> = [
  // Clinical chart — check FIRST (most specific, prevents consent patterns from stealing them)
  { pattern: /\btreatment\s+record\b/i, classification: "clinical_chart", confidence: 0.93 },
  { pattern: /\bprocedure\s+(note|chart|record)\b/i, classification: "clinical_chart", confidence: 0.93 },
  { pattern: /\bclinical\s+(chart|assessment|note)\b/i, classification: "clinical_chart", confidence: 0.93 },
  { pattern: /\bpatient\s+chart\b/i, classification: "clinical_chart", confidence: 0.90 },

  // Consent — broad patterns AFTER clinical
  { pattern: /\bhipaa\b/i, classification: "consent", confidence: 0.98 },
  { pattern: /\bconsent\b/i, classification: "consent", confidence: 0.95 },
  { pattern: /\bwaiver\b/i, classification: "consent", confidence: 0.95 },
  { pattern: /\bauthorization\b/i, classification: "consent", confidence: 0.93 },
  { pattern: /\bpolicy\b/i, classification: "consent", confidence: 0.93 },
  { pattern: /\bpost\s+procedure\b/i, classification: "consent", confidence: 0.93 },
  { pattern: /\bpost[- ]?(care|treatment)(\s+(care|instructions))?\b/i, classification: "consent", confidence: 0.93 },
  { pattern: /\baftercare\b/i, classification: "consent", confidence: 0.93 },
  { pattern: /\brelease\b/i, classification: "consent", confidence: 0.90 },
  { pattern: /\bnerve\s+block\b/i, classification: "consent", confidence: 0.90 },
  { pattern: /\binstructions\b/i, classification: "consent", confidence: 0.88 },

  // Intake — after consent
  { pattern: /\bintake\b/i, classification: "intake", confidence: 0.95 },
  { pattern: /\bmedical\s+history\b/i, classification: "intake", confidence: 0.95 },
  { pattern: /\bpatient\s+(intake|registration)\b/i, classification: "intake", confidence: 0.95 },
  { pattern: /\b(health|medical)\s+(questionnaire|history|assessment)\b/i, classification: "intake", confidence: 0.93 },
  { pattern: /\bquestionnaire\b/i, classification: "intake", confidence: 0.90 },
  { pattern: /\bassessment\s*(checklist|form)?\b/i, classification: "intake", confidence: 0.88 },
];

/**
 * Field labels that strongly suggest clinical_chart regardless of form name.
 */
export const CLINICAL_FIELD_INDICATORS = [
  /\binjection\s*sites?\b/i,
  /\blot\s*number\b/i,
  /\bdilution\b/i,
  /\bpulse\s*width\b/i,
  /\bspot\s*size\b/i,
  /\bunits?\s*(injected|administered|used)\b/i,
  /\bdevice\s*(serial|model|setting)\b/i,
  /\benergy\s*(level|setting|j\/cm)\b/i,
];

export const ENHANCED_CLASSIFICATION_SYSTEM_PROMPT = `You are a MedSpa data migration specialist. Classify each form into one of four categories for the target Neuvvia EMR system.

## Categories & Pipeline Consequences

Your classification determines what happens to each form record in the pipeline. Understand the consequences:

1. **consent** → Record stays as CanonicalConsent. Form data is preserved in consent templateSnapshot. Does NOT enrich the patient record.
2. **clinical_chart** → Record is CONVERTED from CanonicalConsent to CanonicalChart. This triggers:
   - Field type inference (AI determines which fields are text, select, textarea, etc.)
   - Field semantic classification (each field categorized as patient_demographic, patient_medical, clinical_content, or administrative)
   - Demographics + admin fields are FILTERED OUT of the chart template (they stay on the patient record)
   - patient_medical fields (allergies, medicalNotes) are extracted and used to ENRICH the patient record (if empty)
   - Only clinical_content fields survive in the chart template
3. **intake** → Record stays as CanonicalConsent (same as consent). Form data preserved but does NOT enrich patient.
4. **skip** → Record is DELETED entirely. Never reaches the load phase. Use only for forms that have no clinical or legal value.

**Key implication**: If a form has patient demographics AND clinical data (common in MedSpas), classify as clinical_chart — the pipeline will automatically separate demographics from clinical content. If you classify it as consent, ALL fields stay together and nothing enriches the patient record.

## 5-Step Decision Tree

1. **Internal + non-clinical name?** → skip (e.g., "Staff Checklist", "Admin Notes")
2. **Clearly consent-related name?** → consent (consent, waiver, agreement, policy, authorization, HIPAA, aftercare instructions)
3. **Clinical field content?** If ANY field labels contain clinical indicators (units, injection site, device, energy, lot number, dilution, treatment area, complications) → clinical_chart, regardless of form name
4. **Intake/history name?** → intake (intake, history, questionnaire, survey, registration)
5. **Default** → consent (safest for unknown MedSpa forms)

## Tricky Cases
- "Pre-Treatment Checklist" → clinical_chart (documents clinical observations before treatment)
- "Treatment Consent and Record" → clinical_chart IF it has injection/treatment fields, otherwise consent
- "Aftercare Instructions" → consent (post-care patient instructions)
- "Cancellation Policy" → consent
- "Photo Consent" → consent

## Confidence Calibration
- 0.95+ → Unambiguous match (name + fields clearly indicate category)
- 0.85-0.94 → Strong match (name matches well, fields consistent)
- 0.70-0.84 → Name-only match (no field data to confirm)
- 0.50-0.69 → Weak signal, defaulting to best guess
- Below 0.50 → Very uncertain, defaulting to consent

{vendorContext}

## For clinical_chart Classifications
Extract chart data:
- chiefComplaint: Brief treatment summary (e.g., "Botox - Forehead and Glabella")

For non-clinical classifications, set chartData to null.

## PHI Safety
You are receiving field labels and types only — no patient values or PHI.

## Response Format
Return a JSON object:
{
  "classifications": [
    {
      "formSourceId": "...",
      "classification": "consent",
      "confidence": 0.95,
      "reasoning": "Template name 'HIPAA Authorization' is a consent form",
      "chartData": null
    },
    ...
  ]
}`;

/**
 * Build the vendor context section for the classification prompt.
 */
export function buildClassificationVendorContext(classificationHints?: string): string {
  if (!classificationHints) return "";
  return `\n## Vendor-Specific Classification Hints\n${classificationHints}\n`;
}
