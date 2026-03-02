import type { AiProvider } from "./types";
import { MockAiProvider } from "./mock-provider";
import { OpenAiProvider } from "./provider";

export function getAiProvider(): AiProvider {
  // No singleton — re-check env on each call so hot-reload picks up .env changes
  if (process.env.OPENAI_API_KEY) {
    return new OpenAiProvider();
  }

  console.warn("[AI] OPENAI_API_KEY not set — using MockAiProvider (dev only)");
  return new MockAiProvider();
}

// Re-export types for convenience
export type { AiProvider, AIResponse, ChatRequest, ChatMessage, ChatContext } from "./types";
export { MockAiProvider } from "./mock-provider";
export { OpenAiProvider } from "./provider";
