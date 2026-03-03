import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { requireFeature } from "@/lib/feature-flags";
import { FeatureNotAvailableError } from "@/lib/feature-flags-core";
import { executePlanStep } from "@/lib/agents/chat/tools";
import { prisma } from "@/lib/prisma";
import type { PlanStep } from "@/lib/agents/chat/types";
import type { ToolResult } from "@/lib/agents/chat/tools";

/**
 * Extract a usable ID from a tool result's data.
 * Handles common patterns: { matches: [{ id }] }, { id }, { appointments: [...] }, etc.
 */
function extractId(data: Record<string, unknown>): string | null {
  // Direct id field (e.g. create_appointment result)
  if (typeof data.id === "string") return data.id;

  // Lookup tools return { matches: [...] }
  if (Array.isArray(data.matches)) {
    if (data.matches.length === 1 && data.matches[0]?.id) {
      return String(data.matches[0].id);
    }
    return null; // 0 or multiple — can't auto-resolve
  }

  // Provider lookup returns { providers: [...] }
  if (Array.isArray(data.providers) && data.providers.length === 1 && data.providers[0]?.id) {
    return String(data.providers[0].id);
  }

  // Room lookup returns { rooms: [...] }
  if (Array.isArray(data.rooms) && data.rooms.length === 1 && data.rooms[0]?.id) {
    return String(data.rooms[0].id);
  }

  return null;
}

/**
 * Resolve `<from_step_X>` placeholders in step args using previous step results.
 */
function resolveStepArgs(
  args: Record<string, unknown>,
  resultMap: Map<string, ToolResult>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string") {
      const match = value.match(/^<from_step_(\w+)>$/);
      if (match) {
        const refStepId = match[1];
        const refResult = resultMap.get(refStepId);
        if (refResult?.success && refResult.data) {
          const id = extractId(refResult.data);
          if (id) {
            resolved[key] = id;
            continue;
          }
        }
        // Placeholder couldn't be resolved — keep as-is so the tool gives a clear error
      }
    }
    resolved[key] = value;
  }
  return resolved;
}

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
    const resultMap = new Map<string, ToolResult>();

    for (const step of steps) {
      // Resolve <from_step_X> placeholders using previous step results
      const resolvedArgs = resolveStepArgs(step.args, resultMap);
      const resolvedStep = { ...step, args: resolvedArgs };

      const result = await executePlanStep(resolvedStep);
      results.push(result);
      resultMap.set(step.step_id, result);

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
