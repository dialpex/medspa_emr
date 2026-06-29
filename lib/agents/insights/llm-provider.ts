import type { AiProvider, AIResponse, ChatRequest } from "./types";
import { getSystemPrompt } from "./prompts";
import { getLLMProvider, extractJSON } from "../_shared/llm";
import { MockAiProvider } from "./mock-provider";

/**
 * AiProvider backed by the shared LLMProvider factory.
 * Uses whichever LLM is configured (Anthropic, OpenAI, Bedrock)
 * based on env vars — no vendor lock-in.
 */
export class LlmAiProvider implements AiProvider {
  private fallback = new MockAiProvider();

  async chat(request: ChatRequest): Promise<AIResponse> {
    const provider = getLLMProvider();

    if (!provider.isAvailable()) {
      console.warn(`[Chat] ${provider.name} not available — using MockAiProvider`);
      return this.fallback.chat(request);
    }

    const systemPrompt = getSystemPrompt(request.context);

    // Build a single user message from the conversation history.
    // The shared LLMProvider.complete() takes one system + one user message,
    // so we format the multi-turn history into the user message.
    const conversationText = request.messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    try {
      const result = await provider.complete(systemPrompt, conversationText, {
        maxTokens: 2048,
        temperature: 0.3,
      });

      return extractJSON<AIResponse>(result.text);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 429) {
        console.warn(`[Chat] ${provider.name} rate limited — falling back to MockAiProvider`);
        return this.fallback.chat(request);
      }
      console.error(`[Chat] ${provider.name} API call failed:`, err);
      throw new Error(
        `Chat AI error (${provider.name}): ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
