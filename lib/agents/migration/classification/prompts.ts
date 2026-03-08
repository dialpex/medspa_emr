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
  // Consent patterns — very high confidence
  { pattern: /\bhipaa\b/i, classification: "consent", confidence: 0.98 },
  { pattern: /\bconsent\s+(form|to\s+treat)/i, classification: "consent", confidence: 0.95 },
  { pattern: /\bwaiver\b/i, classification: "consent", confidence: 0.95 },
  { pattern: /\bauthorization\b/i, classification: "consent", confidence: 0.93 },
  { pattern: /\bfinancial\s+policy\b/i, classification: "consent", confidence: 0.95 },
  { pattern: /\baftercare\s+instructions?\b/i, classification: "consent", confidence: 0.93 },
  { pattern: /\bpost[- ]?(care|treatment)\s+instructions?\b/i, classification: "consent", confidence: 0.93 },

  // Intake patterns
  { pattern: /\bmedical\s+history\b/i, classification: "intake", confidence: 0.95 },
  { pattern: /\bpatient\s+(intake|registration)\b/i, classification: "intake", confidence: 0.95 },
  { pattern: /\bhealth\s+(questionnaire|history)\b/i, classification: "intake", confidence: 0.93 },

  // Clinical chart patterns
  { pattern: /\btreatment\s+record\b/i, classification: "clinical_chart", confidence: 0.93 },
  { pattern: /\bprocedure\s+(note|chart|record)\b/i, classification: "clinical_chart", confidence: 0.93 },
  { pattern: /\bclinical\s+(chart|assessment|note)\b/i, classification: "clinical_chart", confidence: 0.93 },
];

/**
 * Field labels that strongly suggest clinical_chart regardless of form name.
 */
export const CLINICAL_FIELD_INDICATORS = [
  /\bunits?\b/i,
  /\binjection\s*sites?\b/i,
  /\bdevice\b/i,
  /\benergy\b/i,
  /\bpulse\s*width\b/i,
  /\bspot\s*size\b/i,
  /\blot\s*number\b/i,
  /\bdilution\b/i,
  /\bpre[- ]?treatment\b/i,
  /\bpost[- ]?treatment\b/i,
  /\bcomplications?\b/i,
  /\btreatment\s*area\b/i,
];

export const ENHANCED_CLASSIFICATION_SYSTEM_PROMPT = `You are a MedSpa data migration specialist. Classify each form into one of four categories for the target Neuvvia EMR system.

## Categories

1. **consent** — Consent forms, waivers, agreements, policies, HIPAA notices, authorization forms, post-care instructions
2. **clinical_chart** — Clinical treatment forms, procedure charts, treatment records documenting what was done to the patient
3. **intake** — Patient intake forms, medical history questionnaires, health surveys, registration forms
4. **skip** — Internal admin forms, test forms, or forms that don't belong in the patient's medical record

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
Extract structured chart data:
- chiefComplaint: Brief treatment summary
- templateType: "Injectable" | "Laser" | "Esthetics" | "Other"
- treatmentCardTitle: Specific treatment card name
- narrativeText: Full treatment narrative from form field content
- structuredData: {} (structured data extraction happens later)

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
