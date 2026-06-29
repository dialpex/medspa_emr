---
name: Agent Guardrails
description: Shared architectural rules for all Neuvvia AI agent development. Read this before creating or modifying any agent.
scope: lib/agents/
---

# Engineering Guardrails (Non-Negotiable)

## Zero Tolerance for Assumptions
Never assume authentication, database schemas, API clients, or validation exists unless verified in code. If missing, flag it or implement it.

## No Placeholders
No mock functions, truncated logic, or `// TODO` comments. All code must be production-ready, type-safe TypeScript.

## Mandatory Multi-Turn Loop
Before editing or creating agent files:
1. Search and inspect the repo to map existing files and types.
2. Output a bulleted technical implementation plan.
3. Wait for manual approval before writing code.

# True Agent vs "Fake Agent"

A **fake agent** is a single-turn LLM call, string-interpolation wrapper, or prompt-only file with no tools. Fake agents get demoted to prompt files under the most related true agent.

A **true agent** MUST have all three:

1. **Dynamic Tool Routing** — model uses function-calling (`runToolLoop()`) to choose which tool to run. Never hardcode decision paths.
2. **Self-Correction Loops** — outputs go through runtime validation. Errors feed back into context for self-healing retry. Implemented via `completionWithRetry()` or `runToolLoop()`.
3. **Resilient State Tracking** — sessions persisted DB-side via `AgentSession` model + `lib/services/agent-session.ts`. Must survive drops and reconnects.

# Cascading Model Tiers

| Tier | Role | Default Model | Use For |
|------|------|--------------|---------|
| `triage` | Classification / Extraction | Haiku | Intent routing, JSON extraction, field inference, simple prompts |
| `executor` | Multi-step Agent | Sonnet | Tool-loop agents, complex multi-step reasoning |
| `supervisor` | Critic / Validator | Sonnet | Deep reasoning, final validation, Tier 2 failure escalation |

**Escalation Rule**: If executor fails evaluation, escalate to supervisor. Do NOT retry at same tier.

**Cost Discipline**: Never use executor/supervisor for tasks triage can handle. `getLLMProviderForTier(tier)` is the ONLY way to get an LLM provider — never hardcode models.

Env overrides: `LLM_TIER_TRIAGE`, `LLM_TIER_EXECUTOR`, `LLM_TIER_SUPERVISOR`.

# Agent Creation Checklist

Before creating a new agent directory under `lib/agents/`:

- [ ] Does it have its own **tool definitions**? (If no → prompt file, not an agent)
- [ ] Does it need its own **conversation loop**? (If no → add tools to Insights)
- [ ] Does it have **fundamentally different context** from existing agents? (If no → extend existing)
- [ ] Correct **tier** chosen for each LLM call?
- [ ] Uses `getLLMProviderForTier()`, never hardcoded model?
- [ ] User-facing name is **Neuvvia-branded**?
- [ ] Persists state via **AgentSession** or equivalent?
- [ ] Has **self-correction** (validation + retry/escalation)?
