import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { requireFeature } from "@/lib/feature-flags";
import { FeatureNotAvailableError } from "@/lib/feature-flags-core";
import { getAiProvider } from "@/lib/agents/chat";
import type { ChatMessage } from "@/lib/agents/chat/types";
import { createAuditLogFromRequest } from "@/lib/audit";
import { redactTextPHI } from "@/lib/agents/_shared/phi/text-redactor";
import { validateInput } from "@/lib/validation/helpers";
import { chatMessageSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  try {
    await requireFeature("ai_chat");
    const user = await requirePermission("ai", "create");

    const body = await request.json();
    const validated = validateInput(chatMessageSchema, body);
    const messages: ChatMessage[] = validated.messages;

    // Redact PHI from user messages before sending to LLM
    const redactedMessages: ChatMessage[] = await Promise.all(
      messages.map(async (msg) => {
        if (msg.role === "user") {
          return { ...msg, content: await redactTextPHI(msg.content, user.clinicId) };
        }
        return msg;
      })
    );

    const provider = getAiProvider();
    const response = await provider.chat({
      messages: redactedMessages,
      context: {
        userRole: user.role,
        clinicId: user.clinicId,
        userName: user.name,
      },
    });

    // Audit log (non-blocking — don't fail the response if logging fails)
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    createAuditLogFromRequest(
      {
        clinicId: user.clinicId,
        userId: user.id,
        action: "AiChat",
        entityType: "AiChat",
        entityId: user.id,
        details: JSON.stringify({
          query: lastUserMessage?.content.slice(0, 200),
          responseType: response.type,
          domain: response.domain,
        }),
      },
      request
    ).catch((err: unknown) => console.error("[AI Chat] Audit log failed:", err));

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof FeatureNotAvailableError) {
      return NextResponse.json({ error: "feature_not_available", feature: error.feature }, { status: 403 });
    }
    console.error("[AI Chat] Error:", error);
    const message = error instanceof Error ? error.message : "AI chat failed";
    if (message.includes("Permission denied") || message.includes("Authentication required")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    const detail = process.env.NODE_ENV === "development" ? message : "AI chat failed";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
