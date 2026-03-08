// Vendor Knowledge Abstraction — enriches AI prompts for known vendors,
// optional for unknown ones.

export interface VendorKnowledge {
  vendorName: string;
  /** Field type terminology in this vendor's system, injected into AI prompts */
  fieldTypeHints: string;
  /** Known quirks the AI should account for */
  knownQuirks: string[];
  /** Whether signatures are stored as downloadable images */
  signaturesAreImages: boolean;
  /** Classification hints for form categorization */
  classificationHints: string;
  /** Hints for field semantic classification (demographics, clinical, etc.) */
  fieldClassificationHints?: string;
}

export const BOULEVARD_KNOWLEDGE: VendorKnowledge = {
  vendorName: "Boulevard",
  fieldTypeHints: [
    "Boulevard uses `CustomFormComponentTextInputV2` for short text fields.",
    "Boulevard uses `CustomFormComponentTextarea` for long text / multi-line fields.",
    "Boulevard uses `CustomFormComponentCheckboxV2` for checkboxes with multiple options.",
    "Boulevard uses `CustomFormComponentSignatureV2` for signatures stored as rendered PNG images.",
    "Boulevard uses `CustomFormComponentDateV2` for date pickers.",
    "Boulevard uses `CustomFormComponentDropdownV2` for single/multi-select dropdowns.",
    "Boulevard uses `CustomFormComponentMultipleChoiceV2` / radio for single-select radio buttons.",
    "Boulevard uses `CustomFormComponentH1`/`H2`/`TextV2` for headings and static text.",
    "Boulevard uses `CustomFormComponentImageUploaderV2` for photo uploads.",
    "Boulevard `connected_text` and `connected_date` are standard text/date fields that auto-populate from the patient profile.",
  ].join("\n"),
  knownQuirks: [
    "Boulevard signatures are rendered as images — download the image URL if available.",
    "Boulevard `connected_text`/`connected_date` are standard text/date fields that auto-populate from patient profile.",
    "Boulevard radio buttons are single-select despite being visually different from dropdowns.",
    "Boulevard checkbox fields may have an 'other' free-text option in addition to predefined values.",
    "Boulevard forms are versioned — the same template can have different component structures across versions.",
  ],
  signaturesAreImages: true,
  classificationHints: [
    "Boulevard internal forms (template.internal=true) are typically staff-only checklists or operational forms — classify as 'skip' unless the name suggests clinical content.",
    "Boulevard 'Pre-Treatment Checklist' forms are typically clinical_chart (they document clinical observations before treatment).",
    "Boulevard 'Treatment Consent and Record' forms combine consent + clinical data — classify as clinical_chart if they have injection/treatment fields, otherwise consent.",
    "Boulevard 'Aftercare Instructions' are consent-type documents (post-care instructions).",
  ].join("\n"),
  fieldClassificationHints: [
    "Boulevard `connected_text` and `connected_date` fields auto-populate from the patient profile — their `connectedFieldName` value tells you exactly which patient field they map to.",
    "Common connectedFieldName values: 'First name', 'Last name', 'Email', 'Phone number', 'Date of birth'.",
    "A field labeled 'Age' in a demographics section is equivalent to dateOfBirth — both map to the patient's date of birth.",
    "Boulevard forms often have a 'Client Information' or 'Demographics' heading followed by connected fields for name/DOB/etc. — these are all patient_demographic.",
    "Fields labeled 'Allergies' or 'Known Allergies' should be classified as patient_medical with patientField 'allergies'.",
    "Fields labeled 'Medical History', 'Medical Conditions', or 'Health History' should be classified as patient_medical with patientField 'medicalNotes'.",
    "Heading fields in a demographics section (e.g., 'Client Information', 'Patient Information') are administrative.",
  ].join("\n"),
};

const VENDOR_REGISTRY: Record<string, VendorKnowledge> = {
  boulevard: BOULEVARD_KNOWLEDGE,
};

/**
 * Get vendor knowledge for a known vendor. Returns null for unknown vendors.
 * The AI works without hints for unknown vendors.
 */
export function getVendorKnowledge(source: string): VendorKnowledge | null {
  return VENDOR_REGISTRY[source.toLowerCase()] ?? null;
}
