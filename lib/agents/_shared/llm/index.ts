// LLM Provider factory — returns the appropriate LLMProvider based on config/env.

import type { LLMProvider, LLMProviderConfig } from "./types";
import type { ModelTier } from "./tiers";
import { getModelForTier } from "./tiers";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { BedrockProvider } from "./bedrock";
import { MockLLMProvider } from "./mock";

/** Get an LLMProvider configured for a specific tier's model. */
export function getLLMProviderForTier(tier: ModelTier): LLMProvider {
  const model = getModelForTier(tier);
  // Auto-detect provider from env, but override the default model
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider(model);
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIProvider(model);
  }
  console.warn("[LLM] No API keys set — using MockLLMProvider (dev only)");
  return new MockLLMProvider();
}

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
  ToolLoopMessage,
} from "./types";
export type { ModelTier } from "./tiers";
export { getModelForTier } from "./tiers";
export { AnthropicProvider } from "./anthropic";
export { OpenAIProvider } from "./openai";
export { BedrockProvider } from "./bedrock";
export { MockLLMProvider } from "./mock";
export { extractJSON } from "./utils";
export { completionWithRetry } from "./self-healing";
export type { CompletionWithRetryOptions } from "./self-healing";
