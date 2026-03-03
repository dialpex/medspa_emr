import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { requireFeature } from "@/lib/feature-flags";
import { FeatureNotAvailableError } from "@/lib/feature-flags-core";
import { executePlanStep, isReadOnlyTool } from "@/lib/agents/chat/tools";
import { getLLMProvider, extractJSON } from "@/lib/agents/_shared/llm";
import { getSystemPrompt, getReasoningPrompt } from "@/lib/agents/chat/prompts";
import { prisma } from "@/lib/prisma";
import type { PlanStep, ChatMessage, AIResponse } from "@/lib/agents/chat/types";
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
 * Resolve cross-step references in step args using previous step results.
 * Handles: <from_step_X>, <step_X>, or direct step_id match.
 */
function resolveStepArgs(
  args: Record<string, unknown>,
  resultMap: Map<string, ToolResult>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string") {
      // Try <from_step_X> then <step_X> then direct step_id
      const match = value.match(/^<from_step_(\w+)>$/) ?? value.match(/^<step_(\w+)>$/);
      const refStepId = match?.[1] ?? (resultMap.has(value) ? value : null);

      if (refStepId) {
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

/**
 * Execute all steps sequentially, return tool results and a mechanical summary.
 */
async function executeDirectly(steps: PlanStep[]): Promise<{ results: ToolResult[] }> {
  const results: ToolResult[] = [];
  const resultMap = new Map<string, ToolResult>();

  for (const step of steps) {
    const resolvedArgs = resolveStepArgs(step.args, resultMap);
    const resolvedStep = { ...step, args: resolvedArgs };

    const result = await executePlanStep(resolvedStep);
    results.push(result);
    resultMap.set(step.step_id, result);

    if (!result.success) break;
  }

  return { results };
}

/**
 * Two-phase orchestration: run reads, then let the LLM reason over results.
 */
async function orchestrate(
  steps: PlanStep[],
  messages: ChatMessage[],
  systemPrompt: string
): Promise<AIResponse> {
  const readSteps = steps.filter((s) => isReadOnlyTool(s.tool_name));
  const writeSteps = steps.filter((s) => !isReadOnlyTool(s.tool_name));

  // All writes, no lookups needed — execute directly (skip LLM reasoning)
  if (readSteps.length === 0) {
    const { results } = await executeDirectly(steps);

    const succeeded = results.filter((r) => r.success).length;
    const allSucceeded = succeeded === steps.length;
    const summary = allSucceeded
      ? `Successfully completed all ${steps.length} steps.`
      : `Completed ${succeeded} of ${steps.length} steps. ${results.find((r) => !r.success)?.error || "Some steps failed."}`;

    const details: Record<string, unknown> = {};
    for (const r of results) {
      if (r.data) {
        // Namespace per step to avoid overwrites when multiple steps return same keys
        if (results.length > 1) {
          details[r.step_id] = r.data;
        } else {
          Object.assign(details, r.data);
        }
      }
      if (r.error) details[`error_${r.step_id}`] = r.error;
    }

    return {
      type: "result",
      domain: "general",
      rationale_muted: `Executed plan: ${steps.map((s) => s.tool_name).join(" → ")}`,
      clarification: null,
      plan: null,
      result: { summary, details },
      permission_check: { allowed: true, reason_if_denied: null },
    };
  }

  // Phase 1: execute read-only steps
  const readResults: ToolResult[] = [];
  const resultMap = new Map<string, ToolResult>();

  for (const step of readSteps) {
    const resolvedArgs = resolveStepArgs(step.args, resultMap);
    const resolvedStep = { ...step, args: resolvedArgs };

    const result = await executePlanStep(resolvedStep);
    readResults.push(result);
    resultMap.set(step.step_id, result);

    if (!result.success) {
      // Read failed — return a refuse response
      return {
        type: "refuse",
        domain: "general",
        rationale_muted: `Lookup step "${step.tool_name}" failed: ${result.error}`,
        clarification: null,
        plan: null,
        result: null,
        permission_check: { allowed: true, reason_if_denied: null },
      };
    }
  }

  // Phase 2: LLM reasons over read results
  const reasoningPrompt = getReasoningPrompt(readResults, writeSteps, messages);
  const llm = getLLMProvider();
  const completion = await llm.complete(systemPrompt, reasoningPrompt);
  const response = extractJSON<AIResponse>(completion.text);

  return response;
}

export async function POST(request: NextRequest) {
  try {
    await requireFeature("ai_chat");
    const user = await requirePermission("ai", "create");

    const body = await request.json();
    const steps: PlanStep[] = body.steps;
    const messages: ChatMessage[] | undefined = body.messages;

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: "steps array is required" },
        { status: 400 }
      );
    }

    // Orchestrate mode: messages present → two-phase execution
    if (messages && Array.isArray(messages) && messages.length > 0) {
      const systemPrompt = getSystemPrompt({
        userRole: user.role,
        clinicId: user.clinicId,
        userName: user.name,
      });

      const response = await orchestrate(steps, messages, systemPrompt);

      // Audit log
      prisma.auditLog
        .create({
          data: {
            clinicId: user.clinicId,
            userId: user.id,
            action: "AiPlanOrchestrate",
            entityType: "AiChat",
            entityId: user.id,
            details: JSON.stringify({
              steps_total: steps.length,
              read_steps: steps.filter((s) => isReadOnlyTool(s.tool_name)).length,
              write_steps: steps.filter((s) => !isReadOnlyTool(s.tool_name)).length,
              response_type: response.type,
            }),
          },
        })
        .catch((err: unknown) =>
          console.error("[AI Orchestrate] Audit log failed:", err)
        );

      return NextResponse.json({ response });
    }

    // Direct execution mode: no messages → execute all steps mechanically
    const { results } = await executeDirectly(steps);

    const succeeded = results.filter((r) => r.success).length;
    const allSucceeded = succeeded === steps.length;
    const summary = allSucceeded
      ? `Successfully completed all ${steps.length} steps.`
      : `Completed ${succeeded} of ${steps.length} steps. ${results.find((r) => !r.success)?.error || "Some steps failed."}`;

    const details: Record<string, unknown> = {};
    for (const r of results) {
      if (r.data) {
        if (results.length > 1) {
          details[r.step_id] = r.data;
        } else {
          Object.assign(details, r.data);
        }
      }
      if (r.error) details[`error_${r.step_id}`] = r.error;
    }

    const response: AIResponse = {
      type: "result",
      domain: "general",
      rationale_muted: `Executed plan: ${steps.map((s) => s.tool_name).join(" → ")}`,
      clarification: null,
      plan: null,
      result: { summary, details },
      permission_check: { allowed: true, reason_if_denied: null },
    };

    // Audit log
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
            all_succeeded: allSucceeded,
            tools_used: steps.map((s) => s.tool_name),
          }),
        },
      })
      .catch((err: unknown) =>
        console.error("[AI Execute] Audit log failed:", err)
      );

    return NextResponse.json({ response });
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
