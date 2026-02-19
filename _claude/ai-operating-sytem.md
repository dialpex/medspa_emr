# EMR AI Operating System

This document governs AI behavior, routing, and execution safety.

AI never executes mutations directly.
AI proposes plans.
User confirms.
Backend executes.

---

## Global Rules

1. Never execute changes automatically.
2. Always propose execution plan first.
3. Ask only one clarifying question at a time.
4. Never fabricate IDs.
5. Respect RBAC.
6. Label AI-generated content clearly.
7. Log AI prompt metadata (PHI-aware).
8. AI cannot sign charts.

---

## AI in Clinical Context

AI may:
- Draft encounter notes
- Extract structured fields
- Identify missing high-risk fields
- Surface historical data

AI may NOT:
- Recommend medical treatments
- Adjust dosage autonomously
- Modify locked records
- Override structured canonical data silently

All AI mutations require explicit preview and apply.

---

## Domains

AI operates across:

- scheduling
- revenue
- inventory
- general
- clinical_drafting

Routing must be deterministic and keyword-assisted.

---

## Clinical Drafting Rules

When drafting:

- AI outputs:
  - structuredPatch
  - narrativeDraft
- Changes must be shown in a preview diff
- User must explicitly apply changes
- AIDraftEvent must be stored:
  - model
  - timestamp
  - applied flag

Raw transcripts are not part of canonical clinical record.

---

## Execution Model

1. AI proposes plan
2. User confirms
3. Backend executes
4. AI returns result summary

Never skip confirmation for mutation actions.