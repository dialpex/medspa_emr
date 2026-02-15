# Product Specification – MVP

## Target Cohorts

1. Solo medical provider  
2. Solo esthetician  
3. Small mixed clinic (injector + esthetician)

Single location only for MVP.

---

## Product Vision

Build a fast, AI-assisted, compliance-first EMR for real clinical use.

Priorities:
- Minimal clicks
- Deterministic workflows
- Structured canonical data
- Human-in-the-loop AI
- Auditability
- Modern UX

---

# Core Feature Modules

---

## 1. Calendar & Scheduling

- Day and week views
- Drag to move
- Drag to resize
- Filter by provider and room
- Begin Service action available from appointment

Important:
Appointment ≠ Encounter.

---

## 2. Charting Workflow (AI-First Encounter Model)

### Encounter Lifecycle

1. Appointment booked → no encounter.
2. Begin Service triggered (front desk or provider).
3. Encounter auto-created (idempotent).
4. Initial Treatment Card created.
5. Documentation occurs.
6. Checkout independent.
7. Provider signs.
8. If supervision required → PendingReview.
9. MD co-sign → Finalized.
10. Record locks.
11. Edits require Addendum.

---

### Treatment Card Model

Each Encounter contains Treatment Cards.

Each card includes:
- Narrative (primary)
- Structured JSON blocks
- Media
- Aftercare
- Status indicator

Structured JSON is canonical.

---

### Starter Templates (MVP)

- Injectable
- Laser / Energy-Based
- Esthetics

No dynamic form builder in MVP.

---

### High-Risk Blocking

Injectable:
- Product lot required
- Total units required

Laser:
- Device required
- Energy required
- Pass count required

Esthetics:
- No high-risk by default

Signing blocked if high-risk missing.

---

### AI Drafting

AI triggered explicitly:

- Voice Draft
- Generate from Summary
- Improve Narrative

AI returns:
- structuredPatch
- narrativeDraft

User must preview and apply.

AI cannot modify locked records.

---

### Export

Export includes:
- Encounter header
- Narrative per card
- Structured tables
- Embedded media
- Signature metadata
- Addendum appended

---

## 3. Clinical Photos

- Upload
- Capture
- Vector markup overlay
- Original preserved
- Secure signed URLs

---

## 4. Medical Director Workflow

If supervision enabled:
- Provider signs → PendingReview
- MD co-sign → Finalized
- MD cannot edit

If supervision disabled:
- Provider signature finalizes.

All actions audited.

---

## 5. UX Workflow Priorities

- Fast patient lookup
- One-click jump from appointment → encounter
- Provider flow: Check-in → Begin Service → Chart → Photos → Sign → Invoice
- Medical Director flow: Review → Co-sign → Done
- Patient timeline shows everything chronologically
- UX closer to Boulevard than legacy EMRs

---

## 6. Non-Goals (MVP)

- Multi-location
- Insurance workflows
- SMS/email marketing
- Payment processor integration
- Advanced analytics
- Fully dynamic form builder

---

# Implementation Chunks

Claude must implement one chunk at a time.

---

## Charting Chunks

### Chunk 1 – Begin Service + Encounter Creation
- Idempotent Begin Service endpoint
- Encounter auto-created
- Initial Treatment Card created
- Encounter status = Draft
- Basic encounter UI

### Chunk 2 – Templates + High-Risk Blocking
- Implement starter templates
- Structured canonical JSON
- High-risk blocking before sign

### Chunk 3 – Media Upload + Markup
- Upload and capture
- Vector overlay storage
- Attach to card

### Chunk 4 – AI Typed Draft
- Structured patch + narrative draft
- Preview diff
- AIDraftEvent logging

### Chunk 5 – AI Voice Draft
- Transcription endpoint
- Structured extraction
- Incremental patching

### Chunk 6 – MD Review
- PendingReview
- Co-sign finalize
- Audit logs

### Chunk 7 – Export
- PDF generation
- Narrative + structured tables
- Embedded media