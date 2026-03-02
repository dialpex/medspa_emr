import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getLLMProvider factory", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("returns MockLLMProvider when no API keys set", async () => {
    const { getLLMProvider } = await import("../lib/agents/_shared/llm/index");
    const provider = getLLMProvider();
    expect(provider.name).toBe("mock");
    expect(provider.isAvailable()).toBe(true);
  });

  it("returns AnthropicProvider when ANTHROPIC_API_KEY is set", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const { getLLMProvider } = await import("../lib/agents/_shared/llm/index");
    const provider = getLLMProvider();
    expect(provider.name).toBe("anthropic");
    expect(provider.isAvailable()).toBe(true);
  });

  it("returns OpenAIProvider when only OPENAI_API_KEY is set", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const { getLLMProvider } = await import("../lib/agents/_shared/llm/index");
    const provider = getLLMProvider();
    expect(provider.name).toBe("openai");
  });

  it("prefers Anthropic when both API keys are set", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.OPENAI_API_KEY = "test-key-2";
    const { getLLMProvider } = await import("../lib/agents/_shared/llm/index");
    const provider = getLLMProvider();
    expect(provider.name).toBe("anthropic");
  });

  it("respects explicit config override", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const { getLLMProvider } = await import("../lib/agents/_shared/llm/index");
    const provider = getLLMProvider({ provider: "mock" });
    expect(provider.name).toBe("mock");
  });
});
