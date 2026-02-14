import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getAiProvider } from "@/lib/ai/providers";
import { prisma } from "@/lib/prisma";
import type { ChatMessage } from "@/lib/ai/providers/types";

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("ai", "create");

    const body = await request.json();
    const messages: ChatMessage[] = body.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const provider = getAiProvider();
    const response = await provider.chat({
      messages,
      context: {
        userRole: user.role,
        clinicId: user.clinicId,
        userName: user.name,
      },
    });

    // Audit log (non-blocking — don't fail the response if logging fails)
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    prisma.auditLog
      .create({
        data: {
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
      })
      .catch((err: unknown) => console.error("[AI Chat] Audit log failed:", err));

    return NextResponse.json(response);
  } catch (error) {
    console.error("[AI Chat] Error:", error);
    const message = error instanceof Error ? error.message : "AI chat failed";
    if (message.includes("Permission denied") || message.includes("Authentication required")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    const detail = process.env.NODE_ENV === "development" ? message : "AI chat failed";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
