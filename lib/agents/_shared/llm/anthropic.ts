// AnthropicProvider — LLMProvider implementation using Anthropic SDK.
// NEVER logs prompt content. Only logs: runId, token counts, latency.

import Anthropic from "@anthropic-ai/sdk";
import type { Tool, MessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type {
  LLMProvider,
  ToolHandler,
  CompletionOptions,
  CompletionResult,
  ToolLoopOptions,
  ToolLoopResult,
} from "./types";
import { extractJSON } from "./utils";

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private defaultModel: string;

  constructor(model?: string) {
    this.client = new Anthropic();
    this.defaultModel = model || DEFAULT_MODEL;
  }

  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async complete(
    system: string,
    userMessage: string,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    const response = await this.client.messages.create({
      model: options?.model || this.defaultModel,
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature,
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Anthropic");
    }

    return {
      text: textBlock.text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }

  async runToolLoop(
    system: string,
    userMessage: string,
    toolHandlers: ToolHandler[],
    options?: ToolLoopOptions
  ): Promise<ToolLoopResult> {
    const maxIterations = options?.maxIterations ?? 15;
    const maxTokens = options?.maxTokens ?? 4096;
    const model = options?.model || this.defaultModel;

    const tools: Tool[] = toolHandlers.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Tool["input_schema"],
    }));

    const handlerMap = new Map(toolHandlers.map((t) => [t.name, t.handler]));

    const messages: MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let toolCallCount = 0;
    let finalText = "";

    for (let i = 0; i < maxIterations; i++) {
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature: options?.temperature,
        system,
        messages,
        tools,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Collect any text blocks
      for (const block of response.content) {
        if (block.type === "text") {
          finalText += block.text;
        }
      }

      // Check if we're done (no tool use)
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
      if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
        if (toolUseBlocks.length === 0) break;
      }

      // Add assistant message with all content blocks
      messages.push({ role: "assistant", content: response.content as ContentBlockParam[] });

      // Process tool calls and collect results
      const toolResults: ContentBlockParam[] = [];
      for (const block of toolUseBlocks) {
        if (block.type !== "tool_use") continue;
        toolCallCount++;

        const handler = handlerMap.get(block.name);
        if (!handler) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: Unknown tool "${block.name}"`,
            is_error: true,
          } as unknown as ContentBlockParam);
          continue;
        }

        try {
          const result = await handler(block.input as Record<string, unknown>);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: typeof result === "string" ? result : JSON.stringify(result),
          } as unknown as ContentBlockParam);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: ${msg}`,
            is_error: true,
          } as unknown as ContentBlockParam);
        }
      }

      messages.push({ role: "user", content: toolResults });

      // If stop_reason was end_turn after processing tools, we're done
      if (response.stop_reason === "end_turn") break;
    }

    return {
      finalText,
      toolCallCount,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };
  }
}

// Re-export extractJSON for backward compat
export { extractJSON };
