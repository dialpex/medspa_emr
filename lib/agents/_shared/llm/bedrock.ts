// BedrockProvider — LLMProvider implementation using AWS Bedrock.
// NEVER logs prompt content. Only logs: runId, token counts, latency.

import type {
  LLMProvider,
  CompletionOptions,
  CompletionResult,
  ToolLoopOptions,
  ToolLoopResult,
  ToolHandler,
} from "./types";
import { extractJSON } from "./utils";

interface BedrockConfig {
  region: string;
  modelId: string;
}

function getConfig(): BedrockConfig {
  return {
    region: process.env.AWS_REGION || "us-east-1",
    modelId: process.env.BEDROCK_MODEL_ID || "anthropic.claude-sonnet-4-5-20250929-v1:0",
  };
}

export class BedrockProvider implements LLMProvider {
  readonly name = "bedrock";
  private config: BedrockConfig;

  constructor(config?: Partial<BedrockConfig>) {
    const defaults = getConfig();
    this.config = { ...defaults, ...config };
  }

  isAvailable(): boolean {
    // Bedrock availability depends on AWS credentials being configured
    return !!(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE);
  }

  async complete(
    system: string,
    userMessage: string,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    try {
      const bedrockModule = "@aws-sdk/client-bedrock-runtime";
      const { BedrockRuntimeClient, InvokeModelCommand } = await import(
        /* webpackIgnore: true */ bedrockModule
      );

      const client = new BedrockRuntimeClient({ region: this.config.region });

      const body = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature,
        system,
        messages: [{ role: "user", content: userMessage }],
      });

      const command = new InvokeModelCommand({
        modelId: options?.model || this.config.modelId,
        contentType: "application/json",
        accept: "application/json",
        body: new TextEncoder().encode(body),
      });

      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      const text = responseBody.content?.[0]?.text || "";
      return {
        text,
        inputTokens: responseBody.usage?.input_tokens ?? 0,
        outputTokens: responseBody.usage?.output_tokens ?? 0,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes("Cannot find module") ||
        message.includes("Cannot find package") ||
        message.includes("ERR_MODULE_NOT_FOUND") ||
        message.includes("credentials") ||
        message.includes("Could not load")
      ) {
        console.warn("[Bedrock] AWS SDK unavailable, returning empty response");
        return { text: "", inputTokens: 0, outputTokens: 0 };
      }
      throw error;
    }
  }

  async runToolLoop(
    _system: string,
    _userMessage: string,
    _tools: ToolHandler[],
    _options?: ToolLoopOptions
  ): Promise<ToolLoopResult> {
    // Bedrock tool loop not yet needed — schema discovery uses direct Anthropic.
    throw new Error("Bedrock runToolLoop not yet implemented");
  }
}

// Re-export for convenience
export { extractJSON };
