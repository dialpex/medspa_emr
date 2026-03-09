// Canonical types for migration agent responses.
// Moved from legacy/agent-schemas.ts — these are used by the pipeline,
// classification layer, and UI components.

export interface DiscoveryResponse {
  summary: string;
  entities: Array<{
    type: "Patient" | "Service" | "Appointment" | "Invoice" | "Photo" | "Form" | "Document";
    count: number;
    sampleNames: string[];
  }>;
  issues: Array<{
    severity: "warning" | "error" | "info";
    entityType: string;
    description: string;
    count: number;
  }>;
  recommendations: string[];
}

export interface MappingResponse {
  mappings: Array<{
    sourceId: string;
    sourceName: string;
    action: "map_existing" | "create_new" | "skip" | "needs_input";
    confidence: number;
    reasoning: string;
    targetId: string | null;
    targetName: string | null;
  }>;
  autoResolved: number;
  needsInput: number;
}

export interface VerificationResponse {
  summary: string;
  results: Array<{
    entityType: string;
    sourceCount: number;
    imported: number;
    skipped: number;
    failed: number;
    merged: number;
  }>;
  warnings: string[];
}

export interface FormClassificationResponse {
  classifications: Array<{
    formSourceId: string;
    classification: "consent" | "clinical_chart" | "intake" | "skip";
    confidence: number;
    reasoning: string;
    chartData: {
      chiefComplaint: string;
    } | null;
  }>;
}
