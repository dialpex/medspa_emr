// LLM Provider factory — returns the appropriate LLMProvider based on config/env.

import type { LLMProvider, LLMProviderConfig } from "./types";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { BedrockProvider } from "./bedrock";
import { MockLLMProvider } from "./mock";

export function getLLMProvider(config?: LLMProviderConfig): LLMProvider {
  if (config?.provider) {
    switch (config.provider) {
      case "anthropic":
        return new AnthropicProvider(config.model);
      case "openai":
        return new OpenAIProvider(config.model);
      case "bedrock":
        return new BedrockProvider({ region: config.region });
      case "mock":
        return new MockLLMProvider();
    }
  }

  // Auto-detect from env
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider();
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIProvider();
  }

  console.warn("[LLM] No API keys set — using MockLLMProvider (dev only)");
  return new MockLLMProvider();
}

// Re-export everything
export type {
  LLMProvider,
  LLMProviderConfig,
  ToolHandler,
  CompletionOptions,
  CompletionResult,
  ToolLoopOptions,
  ToolLoopResult,
} from "./types";
export { AnthropicProvider } from "./anthropic";
export { OpenAIProvider } from "./openai";
export { BedrockProvider } from "./bedrock";
export { MockLLMProvider } from "./mock";
export { extractJSON } from "./utils";
