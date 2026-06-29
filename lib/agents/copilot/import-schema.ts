export const TEMPLATE_IMPORT_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "template_import_result",
    strict: true,
    schema: {
      type: "object",
      required: ["suggestedName", "suggestedType", "suggestedCategory", "fields"],
      additionalProperties: false,
      properties: {
        suggestedName: { type: "string" },
        suggestedType: { type: "string", enum: ["chart", "form"] },
        suggestedCategory: { type: "string" },
        fields: {
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
      },
    },
  },
};
