// Anthropic Client — Core SDK wrapper for migration intelligence
// Thin wrapper around @anthropic-ai/sdk with tool-use agentic loop.
// NEVER logs prompt content. Only logs: runId, token counts, latency.

import Anthropic from "@anthropic-ai/sdk";
import type { Tool, MessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";

const MODEL = "claude-sonnet-4-5-20250929";

export interface ToolHandler {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface ToolLoopResult {
  finalText: string;
  toolCallCount: number;
  inputTokens: number;
  outputTokens: number;
}

export class AnthropicClient {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  static isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Single-shot structured response. Sends a system + user message,
   * expects a JSON response, parses and returns it.
   */
  async complete<T>(
    systemPrompt: string,
    userMessage: string,
    maxTokens = 4096
  ): Promise<T> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Anthropic");
    }

    return this.extractJSON<T>(textBlock.text);
  }

  /**
   * Agentic tool-use loop. Sends tools, dispatches handlers, loops
   * until Claude stops calling tools (end_turn or no more tool_use blocks).
   */
  async runToolLoop(
    systemPrompt: string,
    userMessage: string,
    toolHandlers: ToolHandler[],
    maxIterations = 15,
    maxTokens = 4096
  ): Promise<ToolLoopResult> {
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
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
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
        // If stop_reason is end_turn but there are tool uses, process them first
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

  private extractJSON<T>(text: string): T {
    // Try to find JSON in code blocks first
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim());
    }
    // Fall back to finding raw JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Anthropic response");
    }
    return JSON.parse(jsonMatch[0]);
  }
}
