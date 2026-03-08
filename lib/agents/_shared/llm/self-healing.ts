// Self-healing retry wrapper for LLM completions with JSON validation.

import type { LLMProvider, CompletionOptions } from "./types";
import { extractJSON } from "./utils";

export interface CompletionWithRetryOptions extends CompletionOptions {
  maxRetries?: number;
}

/**
 * Attempt an LLM completion, parse JSON, validate the result, and retry on failure.
 * - Parse failure → retry with error feedback asking for valid JSON
 * - Validation failure → retry with the specific error message appended
 * - Max 2 total calls (1 initial + 1 retry) by default, then throws
 * - Returns attempt count for logging/observability
 */
export async function completionWithRetry<T>(
  provider: LLMProvider,
  system: string,
  userMessage: string,
  options: CompletionWithRetryOptions,
  validate: (parsed: T) => { valid: boolean; error?: string }
): Promise<{ result: T; attempts: number }> {
  const maxAttempts = (options.maxRetries ?? 1) + 1;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const message =
      attempt === 1
        ? userMessage
        : `${userMessage}\n\n[ERROR] ${lastError}`;

    const completion = await provider.complete(system, message, options);

    // Try to parse JSON from response
    let parsed: T;
    try {
      parsed = extractJSON<T>(completion.text);
    } catch {
      lastError = "Not valid JSON. Return ONLY a JSON object.";
      if (attempt === maxAttempts) {
        throw new Error(`LLM response not valid JSON after ${maxAttempts} attempts`);
      }
      continue;
    }

    // Validate the parsed result
    const validation = validate(parsed);
    if (validation.valid) {
      return { result: parsed, attempts: attempt };
    }

    lastError = validation.error || "Validation failed";
    if (attempt === maxAttempts) {
      throw new Error(`LLM validation failed after ${maxAttempts} attempts: ${lastError}`);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error("completionWithRetry: unreachable");
}
