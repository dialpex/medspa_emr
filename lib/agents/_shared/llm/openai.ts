// OpenAIProvider — LLMProvider implementation using OpenAI SDK.
// Supports structured outputs via responseSchema option.

import type {
  LLMProvider,
  CompletionOptions,
  CompletionResult,
  ToolLoopOptions,
  ToolLoopResult,
  ToolHandler,
} from "./types";

const DEFAULT_MODEL = "gpt-4o";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private defaultModel: string;

  constructor(model?: string) {
    this.defaultModel = model || DEFAULT_MODEL;
  }

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async complete(
    system: string,
    userMessage: string,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const model = options?.model || this.defaultModel;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createParams: any = {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
    };

    if (options?.responseSchema) {
      createParams.response_format = options.responseSchema;
    }

    const response = await client.chat.completions.create(createParams);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    return {
      text: content,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  }

  async runToolLoop(
    _system: string,
    _userMessage: string,
    _tools: ToolHandler[],
    _options?: ToolLoopOptions
  ): Promise<ToolLoopResult> {
    // OpenAI tool loop is not yet needed — migration uses Anthropic.
    // Placeholder for future implementation.
    throw new Error("OpenAI runToolLoop not yet implemented");
  }
}
