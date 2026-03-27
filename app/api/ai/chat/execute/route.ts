import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { requireFeature } from "@/lib/feature-flags";
import { FeatureNotAvailableError } from "@/lib/feature-flags-core";
import { executePlanStep } from "@/lib/agents/chat/tools";
import { prisma } from "@/lib/prisma";
import type { PlanStep } from "@/lib/agents/chat/types";
import type { ToolResult } from "@/lib/agents/chat/tools";

export async function POST(request: NextRequest) {
  try {
    await requireFeature("ai_chat");
    const user = await requirePermission("ai", "create");

    const body = await request.json();
    const steps: PlanStep[] = body.steps;

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: "steps array is required" },
        { status: 400 }
      );
    }

    const results: ToolResult[] = [];

    for (const step of steps) {
      const result = await executePlanStep(step);
      results.push(result);

      // Stop on first failure (partial results returned)
      if (!result.success) {
        break;
      }
    }

    // Audit log the execution
    prisma.auditLog
      .create({
        data: {
          clinicId: user.clinicId,
          userId: user.id,
          action: "AiPlanExecute",
          entityType: "AiChat",
          entityId: user.id,
          details: JSON.stringify({
            steps_total: steps.length,
            steps_executed: results.length,
            all_succeeded: results.every((r) => r.success),
            tools_used: steps.map((s) => s.tool_name),
          }),
        },
      })
      .catch((err: unknown) =>
        console.error("[AI Execute] Audit log failed:", err)
      );

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof FeatureNotAvailableError) {
      return NextResponse.json(
        { error: "feature_not_available", feature: error.feature },
        { status: 403 }
      );
    }
    console.error("[AI Execute] Error:", error);
    const message =
      error instanceof Error ? error.message : "Plan execution failed";
    if (
      message.includes("Permission denied") ||
      message.includes("Authentication required")
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    const detail =
      process.env.NODE_ENV === "development"
        ? message
        : "Plan execution failed";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
