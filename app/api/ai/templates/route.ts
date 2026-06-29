import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getLLMProviderForTier, completionWithRetry } from "@/lib/agents/_shared/llm";
import { TEMPLATE_GENERATOR_SYSTEM_PROMPT } from "@/lib/agents/insights/template-generator-prompt";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("charts", "create");

    const body = await request.json();
    const messages: ChatMessage[] = body.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    const provider = getLLMProviderForTier("triage");

    if (!provider.isAvailable()) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
    }

    // Build conversation into a single user message for completionWithRetry
    const conversationText = messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const { result } = await completionWithRetry<Record<string, unknown>>(
      provider,
      TEMPLATE_GENERATOR_SYSTEM_PROMPT,
      conversationText,
      { temperature: 0.4, maxTokens: 4096 },
      (parsed) => {
        if (!parsed || typeof parsed !== "object") {
          return { valid: false, error: "Response must be a JSON object" };
        }
        return { valid: true };
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[AI Templates] Error:", error);
    const message = error instanceof Error ? error.message : "AI chat failed";
    if (message.includes("Permission denied") || message.includes("Authentication required")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
