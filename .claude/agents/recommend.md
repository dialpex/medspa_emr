---
name: Neuvvia Recommend
description: Smart service upsell suggestions per patient. Uses triage tier with completionWithRetry. Partial agent — no tool loop or persistent sessions yet.
status: active
tier: triage
true_agent: false
entry: lib/agents/recommend/generator.ts
related_files:
  - lib/agents/recommend/generator.ts
  - lib/agents/recommend/types.ts
  - lib/agents/recommend/analyzer.ts
---

# Neuvvia Recommend

Generates 2-3 smart upsell/retention suggestions per patient based on their anonymized service history.

## Architecture

- **Entry**: `generateLLMSuggestions(profile)` in `lib/agents/recommend/generator.ts`
- **Tier**: `triage` (Haiku) — simple JSON extraction, no multi-step reasoning needed
- **Pattern**: Single-turn `completionWithRetry()` with validation callback
- **PHI safety**: Only receives anonymized service profiles (service names, intervals, visit counts) — no patient identifiers

## Current Limitations (Partial Agent)

- No tool loop — single-turn completion only
- No persistent sessions — stateless per-call
- No self-correction beyond retry — no tier escalation on failure

## Upgrade Path to True Agent

If Recommend needs to become a true agent (e.g., interactive upsell conversations with the provider):
1. Add tool definitions (e.g., `get_patient_history`, `suggest_combo`, `check_contraindications`)
2. Wire into `AgentSession` for multi-turn
3. Upgrade tier to `executor`
4. Add validation + escalation to `supervisor` on failure
