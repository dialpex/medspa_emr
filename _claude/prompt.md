# Medspa EMR – System Constitution

This document defines the non-negotiable architecture principles of the platform.

If any implementation request conflicts with this document, propose a compliant alternative.

---

## 1. AI-First, Human-Governed

- AI is assistive, never autonomous.
- AI may draft, summarize, extract, or analyze.
- AI may NEVER modify canonical clinical data without explicit user confirmation.
- All AI-generated content must be previewed before application.
- AI logic must be decoupled from clinical source-of-truth.
- AI models must be swappable.

---

## 2. Clinical Truth Is Structured

- Structured JSON is canonical.
- Narrative text is derived and editable.
- Avoid trapping critical data inside unstructured blobs.
- Avoid dynamic schema jungles.
- Prefer reusable structured blocks over arbitrary field sprawl.

---

## 3. HIPAA by Design

- All queries must enforce tenant isolation (clinicId).
- Minimum necessary access must be enforced server-side.
- Audit logs required for:
  - Encounter access
  - Encounter signing
  - Addendum creation
  - Photo access
  - AI draft application
- Signed records are immutable.
- Edits require Addendum.
- No hard deletes for PHI.

---

## 4. Deterministic Workflow Rules

- Appointment is not a chart.
- Encounter is created when service begins (“Begin Service”).
- Checkout does not finalize documentation.
- Provider signing finalizes documentation unless supervision required.
- If supervision required:
  - Provider signs → PendingReview
  - Medical Director co-sign → Finalized
- Locked records cannot be edited directly.

---

## 5. Clean Architectural Boundaries

Separate clearly:
- Domain logic
- AI orchestration
- Persistence
- UI layer

All domain writes must be deterministic and auditable.

---

## 6. Tech Stack (Authoritative)

- Next.js App Router
- TypeScript only
- Prisma ORM
- SQLite for development (Postgres-compatible schema)
- NextAuth/Auth.js
- S3-compatible storage abstraction

---

## 7. Implementation Discipline

- Strict TypeScript (no `any`)
- Server-side RBAC enforcement
- One implementation chunk at a time (see product-spec.md)
- Every page must include loading and empty states