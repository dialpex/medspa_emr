import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { requireFeature } from "@/lib/feature-flags";
import { FeatureNotAvailableError } from "@/lib/feature-flags-core";
import { runInsightsAgent } from "@/lib/agents/insights";
import { createAuditLogFromRequest } from "@/lib/audit";
import { redactTextPHI } from "@/lib/agents/_shared/phi/text-redactor";
import { z } from "zod";

const chatSchema = z.object({
  message: z.string().min(1).max(5000),
  sessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireFeature("ai_chat");
    const user = await requirePermission("ai", "create");

    const body = await request.json();
    const { message, sessionId } = chatSchema.parse(body);

    // Redact PHI from user message before sending to LLM
    const redactedMessage = await redactTextPHI(message, user.clinicId);

    const result = await runInsightsAgent(
      sessionId ?? null,
      redactedMessage,
      {
        userRole: user.role,
        clinicId: user.clinicId,
        userName: user.name,
        userId: user.id,
      }
    );

    // Audit log (non-blocking)
    createAuditLogFromRequest(
      {
        clinicId: user.clinicId,
        userId: user.id,
        action: "AiChat",
        entityType: "AiChat",
        entityId: result.sessionId,
        details: JSON.stringify({
          query: message.slice(0, 200),
          toolCallCount: result.toolCallCount,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        }),
      },
      request
    ).catch((err: unknown) => console.error("[AI Chat] Audit log failed:", err));

    return NextResponse.json({
      sessionId: result.sessionId,
      response: result.response,
      tokenUsage: {
        input: result.inputTokens,
        output: result.outputTokens,
      },
    });
  } catch (error) {
    if (error instanceof FeatureNotAvailableError) {
      return NextResponse.json({ error: "feature_not_available", feature: error.feature }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
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
