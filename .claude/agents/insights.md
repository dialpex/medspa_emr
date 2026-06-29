---
name: Neuvvia Insights
description: The primary conversational AI assistant. True agent with tool loop, DB-persisted sessions, and dynamic tool routing. Also houses template-building prompts.
status: active
tier: executor
true_agent: true
entry: lib/agents/insights/index.ts
tools:
  - lookup_service
  - update_service
  - lookup_patient
  - list_appointments
  - get_revenue_summary
related_files:
  - lib/agents/insights/index.ts
  - lib/agents/insights/tools.ts
  - lib/agents/insights/prompts.ts
  - lib/agents/insights/types.ts
  - lib/agents/insights/template-generator-prompt.ts
  - lib/agents/insights/template-import-prompt.ts
  - lib/services/agent-session.ts
  - app/api/ai/chat/route.ts
  - app/(dashboard)/ai-assist/ai-chat-client.tsx
---

# Neuvvia Insights

The single conversational AI assistant for the EMR. This is the only true agent currently active — it uses `runToolLoop()` with DB-persisted sessions.

## Architecture

- **Entry**: `runInsightsAgent(sessionId, userMessage, context)` in `lib/agents/insights/index.ts`
- **Tier**: `executor` (Sonnet) — multi-step reasoning with tool calls
- **Session persistence**: `AgentSession` Prisma model via `lib/services/agent-session.ts`. Messages stored as JSON array. Chat API sends `sessionId` for multi-turn.
- **Tool loop**: `provider.runToolLoop()` with `maxIterations: 10`, `temperature: 0.3`
- **Mock fallback**: When no LLM is available, returns heuristic responses based on keyword matching

## Tools (5)

| Tool | Description | RBAC |
|------|-------------|------|
| `lookup_service` | Search services by partial name, returns prices/durations/categories | All roles |
| `update_service` | Modify service price, duration, or description by ID | All roles (action gated server-side) |
| `lookup_patient` | Search patients by name | All roles |
| `list_appointments` | Query appointments by date/range | All roles |
| `get_revenue_summary` | Revenue totals by period | Owner/Billing only (enforced in tool) |

## Template Prompts (not agent tools — simple completions)

Two prompt-only features live here as `.ts` files (not tools):
- `template-generator-prompt.ts` — system prompt for AI template auto-generator (`/api/ai/templates`)
- `template-import-prompt.ts` — system prompt for PDF/document template import (`/api/templates/import`)

These use `triage` tier via `completionWithRetry()`, NOT the tool loop.

## When to extend vs. create a new agent

Add new tools to Insights when:
- The feature is conversational (user asks questions, agent responds)
- It operates on clinic data (services, patients, appointments, charts)
- It doesn't need a fundamentally different session/context model

Create a separate agent when:
- It has its own tool loop with different tools (e.g., migration, voice transcription)
- It needs different session semantics (e.g., long-running background jobs)
