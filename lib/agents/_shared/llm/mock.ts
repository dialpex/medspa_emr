// MockLLMProvider — Canned responses for dev/test when no API keys are set.

import type {
  LLMProvider,
  CompletionOptions,
  CompletionResult,
  ToolLoopOptions,
  ToolLoopResult,
  ToolHandler,
} from "./types";

export class MockLLMProvider implements LLMProvider {
  readonly name = "mock";

  /** Optionally inject a custom response for testing */
  public mockResponse: string = '{"result": "mock"}';

  isAvailable(): boolean {
    return true;
  }

  async complete(
    _system: string,
    _userMessage: string,
    _options?: CompletionOptions
  ): Promise<CompletionResult> {
    return {
      text: this.mockResponse,
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  async runToolLoop(
    _system: string,
    _userMessage: string,
    _tools: ToolHandler[],
    _options?: ToolLoopOptions
  ): Promise<ToolLoopResult> {
    return {
      finalText: this.mockResponse,
      toolCallCount: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}
