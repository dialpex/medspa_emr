// Structured output schemas for OpenAI GPT-4o migration agent responses

export const DISCOVERY_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "migration_discovery",
    strict: true,
    schema: {
      type: "object",
      required: ["summary", "entities", "issues", "recommendations"],
      additionalProperties: false,
      properties: {
        summary: {
          type: "string",
          description: "Natural-language summary of what was found in the source platform",
        },
        entities: {
          type: "array",
          items: {
            type: "object",
            required: ["type", "count", "sampleNames"],
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                enum: ["Patient", "Service", "Appointment", "Invoice", "Photo"],
              },
              count: { type: "number" },
              sampleNames: {
                type: "array",
                items: { type: "string" },
                description: "Up to 5 sample names/identifiers for this entity type",
              },
            },
          },
        },
        issues: {
          type: "array",
          items: {
            type: "object",
            required: ["severity", "entityType", "description", "count"],
            additionalProperties: false,
            properties: {
              severity: { type: "string", enum: ["warning", "error", "info"] },
              entityType: { type: "string" },
              description: { type: "string" },
              count: { type: "number" },
            },
          },
        },
        recommendations: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  },
};

export const MAPPING_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "migration_mapping",
    strict: true,
    schema: {
      type: "object",
      required: ["mappings", "autoResolved", "needsInput"],
      additionalProperties: false,
      properties: {
        mappings: {
          type: "array",
          items: {
            type: "object",
            required: [
              "sourceId",
              "sourceName",
              "action",
              "confidence",
              "reasoning",
              "targetId",
              "targetName",
            ],
            additionalProperties: false,
            properties: {
              sourceId: { type: "string" },
              sourceName: { type: "string" },
              action: {
                type: "string",
                enum: ["map_existing", "create_new", "skip", "needs_input"],
              },
              confidence: { type: "number", description: "0.0 to 1.0" },
              reasoning: { type: "string" },
              targetId: {
                anyOf: [{ type: "string" }, { type: "null" }],
                description: "Neuvvia service ID if mapping to existing",
              },
              targetName: {
                anyOf: [{ type: "string" }, { type: "null" }],
                description: "Neuvvia service name if mapping to existing",
              },
            },
          },
        },
        autoResolved: { type: "number" },
        needsInput: { type: "number" },
      },
    },
  },
};

export const DECISION_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "migration_decisions",
    strict: true,
    schema: {
      type: "object",
      required: ["decisions"],
      additionalProperties: false,
      properties: {
        decisions: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "entityType", "description", "options", "recommendedOption", "reasoning"],
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              entityType: { type: "string" },
              description: { type: "string" },
              options: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "label", "description"],
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
                    label: { type: "string" },
                    description: { type: "string" },
                  },
                },
              },
              recommendedOption: { type: "string" },
              reasoning: { type: "string" },
            },
          },
        },
      },
    },
  },
};

export const VERIFICATION_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "migration_verification",
    strict: true,
    schema: {
      type: "object",
      required: ["summary", "results", "warnings"],
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        results: {
          type: "array",
          items: {
            type: "object",
            required: ["entityType", "sourceCount", "imported", "skipped", "failed", "merged"],
            additionalProperties: false,
            properties: {
              entityType: { type: "string" },
              sourceCount: { type: "number" },
              imported: { type: "number" },
              skipped: { type: "number" },
              failed: { type: "number" },
              merged: { type: "number" },
            },
          },
        },
        warnings: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  },
};

// TypeScript types matching the schemas above

export interface DiscoveryResponse {
  summary: string;
  entities: Array<{
    type: "Patient" | "Service" | "Appointment" | "Invoice" | "Photo";
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

export interface DecisionResponse {
  decisions: Array<{
    id: string;
    entityType: string;
    description: string;
    options: Array<{
      id: string;
      label: string;
      description: string;
    }>;
    recommendedOption: string;
    reasoning: string;
  }>;
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
