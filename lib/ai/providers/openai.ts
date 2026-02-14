import OpenAI from "openai";
import type { AiProvider, AIResponse, ChatRequest } from "./types";
import { getSystemPrompt } from "../system-prompt";
import { MockAiProvider } from "./mock";

// Strict JSON schema so OpenAI always returns a valid AIResponse shape.
// OpenAI structured outputs require all object properties to be required,
// and optional fields use anyOf with null type.
const AI_RESPONSE_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "emr_ai_response",
    strict: true,
    schema: {
      type: "object",
      required: ["type", "domain", "rationale_muted", "clarification", "plan", "result", "permission_check"],
      additionalProperties: false,
      properties: {
        type: {
          type: "string",
          enum: ["clarify", "plan", "result", "refuse"],
        },
        domain: {
          type: "string",
          enum: ["scheduling", "revenue", "inventory", "general"],
        },
        rationale_muted: { type: "string" },
        clarification: {
          anyOf: [
            {
              type: "object",
              required: ["question", "choices"],
              additionalProperties: false,
              properties: {
                question: { type: "string" },
                choices: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["id", "label"],
                    additionalProperties: false,
                    properties: {
                      id: { type: "string" },
                      label: { type: "string" },
                    },
                  },
                },
              },
            },
            { type: "null" },
          ],
        },
        plan: {
          anyOf: [
            {
              type: "object",
              required: ["execution_mode_prompt", "steps", "confirm_prompt"],
              additionalProperties: false,
              properties: {
                execution_mode_prompt: { type: "boolean" },
                steps: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["step_id", "tool_name", "args", "preview"],
                    additionalProperties: false,
                    properties: {
                      step_id: { type: "string" },
                      tool_name: { type: "string" },
                      args: { type: "object", additionalProperties: true },
                      preview: { type: "string" },
                    },
                  },
                },
                confirm_prompt: { type: "string" },
              },
            },
            { type: "null" },
          ],
        },
        result: {
          anyOf: [
            {
              type: "object",
              required: ["summary", "details"],
              additionalProperties: false,
              properties: {
                summary: { type: "string" },
                details: { type: "object", additionalProperties: true },
              },
            },
            { type: "null" },
          ],
        },
        permission_check: {
          type: "object",
          required: ["allowed", "reason_if_denied"],
          additionalProperties: false,
          properties: {
            allowed: { type: "boolean" },
            reason_if_denied: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
          },
        },
      },
    },
  },
};

export class OpenAiProvider implements AiProvider {
  private client: OpenAI;
  private fallback: MockAiProvider;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.fallback = new MockAiProvider();
  }

  async chat(request: ChatRequest): Promise<AIResponse> {
    const systemPrompt = getSystemPrompt(request.context);

    let response;
    try {
      response = await this.client.chat.completions.create({
        model: "gpt-4o",
        response_format: AI_RESPONSE_SCHEMA,
        messages: [
          { role: "system", content: systemPrompt },
          ...request.messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        temperature: 0.3,
        max_tokens: 2048,
      });
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 429) {
        console.warn("[OpenAI] Quota/rate limit exceeded — falling back to MockAiProvider");
        return this.fallback.chat(request);
      }
      console.error("[OpenAI] API call failed:", err);
      throw new Error(
        `OpenAI API error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    // With strict schema, the response is guaranteed to match the shape.
    // JSON.parse is still needed since content is a string.
    const parsed = JSON.parse(content) as AIResponse;
    return parsed;
  }
}
