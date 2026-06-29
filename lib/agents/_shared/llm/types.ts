// LLMProvider — Vendor-agnostic interface for LLM completions and tool loops.

import type { ModelTier } from "./tiers";

export interface ToolHandler {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** OpenAI structured outputs schema; ignored by Anthropic/Bedrock */
  responseSchema?: Record<string, unknown>;
  /** Model tier for observability/logging */
  tier?: ModelTier;
}

export interface ToolLoopMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolLoopOptions extends CompletionOptions {
  maxIterations?: number;
  /** Prior conversation messages to prepend before the current user message */
  messageHistory?: ToolLoopMessage[];
}

export interface CompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ToolLoopResult {
  finalText: string;
  toolCallCount: number;
  inputTokens: number;
  outputTokens: number;
}

export interface LLMProvider {
  readonly name: string;
  isAvailable(): boolean;

  complete(
    system: string,
    userMessage: string,
    options?: CompletionOptions
  ): Promise<CompletionResult>;

  runToolLoop(
    system: string,
    userMessage: string,
    tools: ToolHandler[],
    options?: ToolLoopOptions
  ): Promise<ToolLoopResult>;
}

export interface LLMProviderConfig {
  provider: "anthropic" | "openai" | "bedrock" | "mock";
  model?: string;
  apiKey?: string;
  region?: string;
}
