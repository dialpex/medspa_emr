---
name: Neuvvia Scribe
description: Voice-to-chart drafting agent. Will transcribe provider dictation and draft structured chart fields. Not yet built.
status: future
tier: executor
true_agent: true
entry: lib/agents/scribe/
related_files: []
---

# Neuvvia Scribe

Voice-to-chart drafting — transcribes provider dictation during encounters and drafts structured chart template fields automatically.

## Status: NOT YET BUILT

Previously existed as part of the TreatmentCard system (removed in commit 183a7fe). Needs to be rebuilt targeting chart template `fieldsConfig` fields directly.

## Planned Architecture

- **Tier**: `executor` (Sonnet) — needs multi-step reasoning to map speech to structured fields
- **True agent**: Yes — will need tool loop to interact with chart templates, field validation, and patient context
- **Session persistence**: Via `AgentSession` — voice sessions may span multiple utterances within an encounter
- **Self-correction**: Validate drafted fields against template schema, retry/escalate on structural errors

## Planned Tools

- `get_chart_template` — load the active template's field definitions
- `draft_fields` — propose values for template fields from transcription
- `validate_draft` — check drafted values against field types and constraints
- `get_patient_context` — load relevant patient history for context (allergies, prior treatments)

## Dependencies

- `AiDraftEvent` Prisma model needs to be recreated (was removed), pointing to `chartId`
- Audio transcription integration (Whisper API or equivalent)
- Real-time streaming consideration for live dictation
