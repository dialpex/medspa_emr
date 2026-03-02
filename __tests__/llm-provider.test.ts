import { describe, it, expect } from "vitest";
import { MockLLMProvider } from "../lib/agents/_shared/llm/mock";
import type {
  LLMProvider,
  CompletionResult,
  ToolLoopResult,
  ToolHandler,
} from "../lib/agents/_shared/llm/types";
import { extractJSON } from "../lib/agents/_shared/llm/utils";

describe("MockLLMProvider", () => {
  it("implements LLMProvider interface", () => {
    const provider: LLMProvider = new MockLLMProvider();
    expect(provider.name).toBe("mock");
    expect(provider.isAvailable()).toBe(true);
  });

  it("complete() returns default mock response", async () => {
    const provider = new MockLLMProvider();
    const result = await provider.complete("system", "user");

    expect(result).toHaveProperty("text");
    expect(result).toHaveProperty("inputTokens");
    expect(result).toHaveProperty("outputTokens");
    expect(typeof result.text).toBe("string");
    expect(result.inputTokens).toBeGreaterThanOrEqual(0);
    expect(result.outputTokens).toBeGreaterThanOrEqual(0);
  });

  it("complete() returns configured mock response", async () => {
    const provider = new MockLLMProvider();
    provider.mockResponse = '{"status": "ok"}';
    const result = await provider.complete("system", "user");
    expect(result.text).toBe('{"status": "ok"}');
  });

  it("runToolLoop() returns correct shape", async () => {
    const tool: ToolHandler = {
      name: "test_tool",
      description: "A test tool",
      input_schema: { type: "object", properties: {} },
      handler: async () => ({ result: "done" }),
    };

    const provider = new MockLLMProvider();
    const result = await provider.runToolLoop("system", "user", [tool]);

    expect(result).toHaveProperty("finalText");
    expect(result).toHaveProperty("toolCallCount");
    expect(result).toHaveProperty("inputTokens");
    expect(result).toHaveProperty("outputTokens");
    expect(result.toolCallCount).toBe(0);
  });
});

describe("extractJSON", () => {
  it("extracts JSON from clean JSON string", () => {
    const input = '{"name": "test", "value": 42}';
    const result = extractJSON<{ name: string; value: number }>(input);
    expect(result).toEqual({ name: "test", value: 42 });
  });

  it("extracts JSON from markdown code block", () => {
    const input = 'Here is the result:\n```json\n{"name": "test"}\n```\nDone.';
    const result = extractJSON<{ name: string }>(input);
    expect(result).toEqual({ name: "test" });
  });

  it("extracts JSON from text with surrounding content", () => {
    const input = 'The mapping is: {"sourceVendor": "boulevard", "version": 1} as shown above.';
    const result = extractJSON<{ sourceVendor: string; version: number }>(input);
    expect(result).toEqual({ sourceVendor: "boulevard", version: 1 });
  });

  it("throws on invalid JSON", () => {
    expect(() => extractJSON("no json here")).toThrow();
  });
});
