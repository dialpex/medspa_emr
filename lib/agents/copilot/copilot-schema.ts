export const TEMPLATE_COPILOT_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "template_copilot_response",
    strict: true,
    schema: {
      type: "object",
      required: ["message", "suggestedFields", "suggestedName", "suggestedType", "suggestedCategory", "isComplete"],
      additionalProperties: false,
      properties: {
        message: { type: "string" },
        isComplete: { type: "boolean" },
        suggestedName: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        suggestedType: {
          anyOf: [{ type: "string", enum: ["chart", "form"] }, { type: "null" }],
        },
        suggestedCategory: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        suggestedFields: {
          anyOf: [
            {
              type: "array",
              items: {
                type: "object",
                required: ["key", "label", "type", "required"],
                additionalProperties: false,
                properties: {
                  key: { type: "string" },
                  label: { type: "string" },
                  type: {
                    type: "string",
                    enum: [
                      "text", "textarea", "select", "multiselect", "number",
                      "date", "checklist", "signature", "photo-single",
                      "heading", "first-name", "last-name",
                    ],
                  },
                  required: { type: "boolean" },
                  options: {
                    anyOf: [
                      { type: "array", items: { type: "string" } },
                      { type: "null" },
                    ],
                  },
                  placeholder: {
                    anyOf: [{ type: "string" }, { type: "null" }],
                  },
                },
              },
            },
            { type: "null" },
          ],
        },
      },
    },
  },
};
