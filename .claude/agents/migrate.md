---
name: Neuvvia Migrate
description: Data migration intelligence — classification, field inference, and semantic mapping for vendor data imports. Partial agent using triage tier.
status: active
tier: triage
true_agent: false
entry: lib/agents/migrate/
related_files:
  - lib/agents/migrate/classification/classify.ts
  - lib/agents/migrate/field-classification/classify.ts
  - lib/agents/migrate/field-inference/infer.ts
  - lib/agents/migrate/prompts.ts
  - lib/agents/migrate/tools.ts
  - lib/agents/migrate/types.ts
  - lib/agents/migrate/knowledge/
  - lib/agents/migrate/vendor-knowledge.ts
  - lib/migration/pipeline/orchestrator.ts
  - lib/migration/pipeline/phases/transform.ts
---

# Neuvvia Migrate

AI intelligence layer for the 8-phase migration pipeline. Handles form classification, field inference, and semantic mapping when importing data from external vendor systems.

## Architecture

- **Entry points**: Multiple — called by pipeline phases, not a single agent entry
  - `classifyForm()` — classify vendor forms as clinical/consent/skip
  - `classifyFields()` — map vendor fields to canonical EMR fields
  - `inferFieldSemantics()` — AI-driven field type inference
- **Tier**: `triage` (Haiku) — classification and extraction tasks, cost-optimized
- **Pattern**: `completionWithRetry()` with validation callbacks per classification type
- **Knowledge Store**: `lib/agents/migrate/knowledge/` — long-term intelligence with confidence scores, cross-vendor elevation, and decay

## Current Limitations (Partial Agent)

- No tool loop — each classification is a single-turn completion
- No persistent sessions — stateless, called by pipeline phases
- No interactive conversation — runs as background pipeline steps
- Self-correction limited to retry (no tier escalation yet)

## Vendor Knowledge System

- Vendor-specific knowledge packs enhance AI classification accuracy
- Unknown vendors still work via AI-only inference
- Knowledge facts grow with confirmation, decay with staleness
- User corrections are highest-confidence signals

## Integration with Pipeline

Called during the **Transform** phase via `enrichFormsWithClassification()` in `phases/transform.ts`. The pipeline orchestrator manages the overall flow — Migrate agents are tools within that flow, not standalone conversational agents.
