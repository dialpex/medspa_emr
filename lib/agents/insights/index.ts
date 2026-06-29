// Neuvvia Insights — true agent using runToolLoop() with DB-persisted sessions.

import { getLLMProviderForTier } from "@/lib/agents/_shared/llm";
import { getModelForTier } from "@/lib/agents/_shared/llm/tiers";
import type { ToolLoopMessage } from "@/lib/agents/_shared/llm/types";
import {
  createSession,
  appendMessages,
  getSessionMessages,
  type SessionMessage,
} from "@/lib/services/agent-session";
import { getSystemPrompt } from "./prompts";
import { insightsTools } from "./tools";
import type { ChatContext, InsightsResult } from "./types";

export type { ChatContext, InsightsResult } from "./types";

/**
 * Run the Insights agent for a single user turn.
 * - Loads (or creates) a session
 * - Builds message history
 * - Runs the tool loop
 * - Persists the conversation
 */
export async function runInsightsAgent(
  sessionId: string | null,
  userMessage: string,
  context: ChatContext & { userId: string }
): Promise<InsightsResult> {
  // Create session if needed
  let sid: string;
  if (sessionId) {
    sid = sessionId;
  } else {
    const session = await createSession(context.clinicId, context.userId, "insights");
    sid = session.id;
  }

  // Load prior messages for context
  const priorMessages = await getSessionMessages(sid);
  const messageHistory: ToolLoopMessage[] = priorMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const provider = getLLMProviderForTier("executor");
  const systemPrompt = getSystemPrompt(context);
  const tools = insightsTools(context.clinicId);

  // Check if provider is available (mock fallback)
  if (!provider.isAvailable()) {
    const fallbackResponse = getMockResponse(userMessage, context);
    const newMessages: SessionMessage[] = [
      { role: "user", content: userMessage },
      { role: "assistant", content: fallbackResponse },
    ];
    await appendMessages(sid, newMessages);
    return {
      sessionId: sid,
      response: fallbackResponse,
      inputTokens: 0,
      outputTokens: 0,
      toolCallCount: 0,
    };
  }

  const result = await provider.runToolLoop(
    systemPrompt,
    userMessage,
    tools,
    {
      model: getModelForTier("executor"),
      maxTokens: 2048,
      temperature: 0.3,
      maxIterations: 10,
      messageHistory,
      tier: "executor",
    }
  );

  // Persist the conversation turn
  const newMessages: SessionMessage[] = [
    { role: "user", content: userMessage },
    { role: "assistant", content: result.finalText },
  ];
  await appendMessages(sid, newMessages);

  return {
    sessionId: sid,
    response: result.finalText,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    toolCallCount: result.toolCallCount,
  };
}

/** Simple mock response when no LLM is available. */
function getMockResponse(text: string, context: ChatContext): string {
  const t = text.toLowerCase();

  if (t.includes("hello") || t.includes("hi") || t.includes("help")) {
    return `Hi ${context.userName}! I'm Neuvvia Insights. I can help with:\n- **Services** — look up and update pricing, durations\n- **Patients** — search by name\n- **Appointments** — view today's schedule\n- **Revenue** — summaries and reports (Owner/Billing only)\n\nWhat would you like to do?`;
  }

  if (t.includes("revenue") || t.includes("sales") || t.includes("billing")) {
    if (context.userRole !== "Owner" && context.userRole !== "Billing") {
      return `Revenue data is restricted to Owner and Billing roles. Your current role (${context.userRole}) doesn't have access. Please contact an Owner or Billing team member.`;
    }
    return "I'd need to look up your revenue data. Could you specify a time period? (e.g., \"this month\", \"last 30 days\", \"Q1 2026\")";
  }

  if (t.includes("appointment") || t.includes("schedule") || t.includes("book")) {
    return "I can look up appointments. What date would you like to check? (e.g., \"today\", \"tomorrow\", or a specific date)";
  }

  return "I'd be happy to help! Could you tell me what you'd like to do? I can assist with services, patients, appointments, and revenue insights.";
}
