import type { AiProvider } from "./types";
import { MockAiProvider } from "./mock-provider";
import { OpenAiProvider } from "./provider";
import { LlmAiProvider } from "./llm-provider";

export function getAiProvider(): AiProvider {
  // No singleton — re-check env on each call so hot-reload picks up .env changes
  // Prefer shared LLMProvider (supports Anthropic, OpenAI, Bedrock via env auto-detect)
  if (process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) {
    return new LlmAiProvider();
  }

  console.warn("[AI] No API keys set — using MockAiProvider (dev only)");
  return new MockAiProvider();
}

// Re-export types for convenience
export type { AiProvider, AIResponse, ChatRequest, ChatMessage, ChatContext } from "./types";
export { MockAiProvider } from "./mock-provider";
export { OpenAiProvider } from "./provider";
export { LlmAiProvider } from "./llm-provider";
