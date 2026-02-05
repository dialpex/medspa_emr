# Medspa EMR / Practice Management MVP – Product Spec

You are a senior staff engineer, product architect, and UX-focused system designer.

Your task is to design and build an MVP web application for a medical aesthetics / medspa practice, inspired by Aesthetic Record, Mangomint, and Boulevard.

The goal is NOT to clone these products, but to build a modern, performant, UX-first system that covers the most critical clinical and operational workflows with a clean and intuitive experience.

---

## CORE PRODUCT GOALS
- Extremely easy to use
- Modern, clean, slick UI
- Minimal clicks for core workflows
- Fast and responsive
- Designed for real clinical use, not demos
---

## AI-FIRST + HIPAA-BY-DESIGN PRINCIPLES (CRITICAL)

This application is intentionally being built as an **AI-augmented, compliance-first platform**.

All future development must assume:
- Extensive AI features will be added over time
- The system must remain HIPAA compliant
- Scalability, observability, and auditability are first-class concerns

Claude must consider these principles in **every architectural and implementation decision**, even if the immediate chunk does not include AI features.

---

### AI-FIRST DESIGN INTENT

This product will progressively introduce AI-driven capabilities such as (non-exhaustive):
- AI-assisted charting and clinical documentation
- Smart treatment recommendations
- Photo analysis and comparison (non-diagnostic)
- Automated chart review support for Medical Directors
- Patient communication drafts (provider-reviewed)
- Operational insights and forecasting
- Risk flags and compliance reminders

Therefore:

- Core domain models must be **AI-ready**
- Data structures should favor **structured + semantically rich fields**
- Avoid designs that trap data in unstructured blobs when structured alternatives exist
- Prefer explicit fields over opaque JSON unless the JSON is intentionally modeled for AI consumption
- Design with future vector embeddings, summaries, and metadata augmentation in mind

Claude should:
- Favor clean, explicit domain boundaries
- Keep AI-related logic **decoupled** from core clinical truth
- Never allow AI to mutate source-of-truth clinical data without explicit human action

---

### HIPAA & COMPLIANCE BY DESIGN

This system must be built as if it will be audited.

Design requirements:
- Minimum Necessary Access enforced server-side
- Strong role-based access control (RBAC)
- Tenant isolation at every query boundary
- Explicit audit logging for:
  - PHI access
  - Chart viewing
  - Chart signing
  - Photo access
  - Consent access
- Immutable clinical records after MD sign-off
- Soft deletes instead of hard deletes for PHI
- No AI system may:
  - Autonomously modify clinical records
  - Autonomously sign charts
  - Act without traceability

Compliance assumptions:
- All PHI is sensitive by default
- Logs must be designed to support forensic review
- Every future AI feature must be explainable, traceable, and optionally disableable

---

### AI SAFETY & GOVERNANCE GUARDRAILS

When AI features are added:
- AI outputs must be clearly labeled as AI-generated
- Human-in-the-loop approval is mandatory for clinical actions
- AI must be implemented as advisory, not authoritative
- AI prompts, inputs, and outputs should be loggable (with PHI redaction strategies in mind)
- Design must allow for future model swaps without rewriting core logic

Claude must not:
- Hardcode assumptions about specific AI models
- Embed proprietary AI logic directly into domain models
- Blur the line between clinical truth and AI suggestion

---

### SCALABILITY & FUTURE READINESS

Assume:
- Multi-clinic → multi-org → enterprise growth
- Increasing data volume (photos, charts, logs)
- Eventual background processing and async workflows
- Future move from SQLite → Postgres → managed cloud DB

Therefore:
- Favor clear boundaries and services
- Avoid tight coupling between UI, domain, and persistence layers
- Design schemas and APIs with forward compatibility in mind

---

### ABSOLUTE RULE

Claude must treat:
- `_claude/prompt.md` as the authoritative product and architecture guide
- Any future chunk instructions as constrained by this section

If a requested implementation would violate AI-first design, HIPAA principles, or long-term scalability, Claude must:
- Call it out explicitly
- Propose a compliant alternative

---

## STRICT LANGUAGE & PLATFORM REQUIREMENTS
- TypeScript only (frontend and backend)
- JavaScript/TypeScript ecosystem only
- Web-first, mobile-friendly UI

---

## TECH STACK (AUTHORITATIVE)
Frontend:
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui

Backend:
- Next.js Server Actions or API Routes (choose one and be consistent)
- Prisma ORM

Database:
- SQLite for local development
- Schema must be Postgres-compatible

Auth & Security:
- NextAuth/Auth.js
- Role-based access control enforced server-side

Storage:
- S3-compatible abstraction (local filesystem for dev)

## TYPESCRIPT
- Prefer `interface` for component props (named `ComponentNameProps`)
- Use string unions (`'primary' | 'secondary'`) over enums
- Prefer `type` for unions/intersections, `interface` for object shapes that may be extended
- For objects: `Record<string, unknown>` for arbitrary keys, `Record<string, never>` for empty
- Avoid `any` — use `unknown` and narrow with type guards
- Use TSDoc format for exported function/type documentation

## REACT COMPONENTS
- Function components with hooks only (no class components)
- Destructure props in function parameters
- Use unique identifiers as keys, not array indices
- Memoization only when clear performance benefits
- Use `data-testid` attributes for test selectors
- Colocate related files (component, styles, tests)
- Prefer controlled components for forms
- Event handlers named `handleX` (e.g., `handleClick`, `handleSubmit`)

---

## KEY MVP FEATURES

### 1) Calendar & Scheduling (CRITICAL)
- Day and week views
- Visual, drag-and-drop calendar
- Click to create appointment
- Drag to move appointment
- Drag resize to change appointment duration
- Filter by provider and room
- Clear appointment status indicators

### 2) Patient Booking Portal
- Public-facing booking flow
- Minimal steps
- Mobile-friendly
- Patient selects service, time, optional provider
- Collect only essential info (name, phone/email)
- Creates appointment in main calendar

### 3) Patients & CRM
- Patient profile with demographics
- Allergies and medical notes
- Tags
- Visit timeline showing:
  - Appointments
  - Charts
  - Photos
  - Consents
  - Invoices

### 4) Clinical Charting
- Structured treatment notes
- Areas treated
- Products used
- Lot and expiration tracking
- Dosage/units
- Technique and aftercare notes

### 5) Clinical Photos with Markup (CRITICAL)
- Upload before/after photos
- Photos linked to visits
- Simple annotation tools:
  - Draw lines
  - Place numbered points
- Designed for facial mapping
- Original image must never be modified
- Annotations stored as vector/JSON overlays

### 6) Medical Director Review & Sign-Off (CRITICAL)
- Special role: MedicalDirector
- Read-only access to charts, photos, consents
- Cannot edit or delete data
- Can electronically sign charts
- Chart lifecycle:
  - Draft
  - NeedsSignOff
  - MDSigned
- Signature metadata:
  - signer userId
  - signer name
  - timestamp
  - immutable record hash

### 7) Roles & Permissions
Roles:
- Owner/Admin
- Provider
- FrontDesk
- Billing
- MedicalDirector
- ReadOnly

Rules:
- Permissions enforced server-side
- UI reflects permissions but does not enforce them alone

### 8) Consents
- Consent templates
- Patient signature capture
- Linked to visits
- Immutable audit trail

### 9) Billing (MVP Level)
- Invoice creation
- Line items
- Discounts
- Tax toggle
- Payment status tracking only
- No payment processor in v1

### 10) Memberships & Packages
- Credit-based memberships
- Expiration rules
- Usage ledger

### 11) Reporting (Basic)
- Appointments by provider
- Revenue by date range
- Most used services

---

## UX & WORKFLOW PRIORITIES
- Fast patient lookup
- One-click jump from appointment → chart
- Provider flow:
  Check-in → chart → photos → sign → invoice
- Medical Director flow:
  Review → sign → done
- Patient timeline shows everything chronologically
- UX closer to Boulevard than legacy EMRs

---

## ARCHITECTURE REQUIREMENTS
- Multi-tenant ready with Clinic table
- clinicId on all relevant tables
- Strict tenant isolation
- Audit logging for:
  - Chart access
  - Chart signing
- Soft deletes for clinical records
- Designed for future encryption of sensitive fields
- Signed URLs for photo access

---

## DELIVERY STRATEGY (IMPORTANT)
The application must be built in small, runnable chunks.

Chunk order:
1. Database schema + seed data
2. Auth + RBAC
3. Patients module
4. Calendar & scheduling
5. Charting + photo upload + markup
6. Medical Director sign-off workflow
7. Booking portal
8. Billing & memberships
9. Reports

Claude must never implement more than ONE chunk at a time unless explicitly instructed.

---

## IMPORTANT CONSTRAINTS
- Keep MVP tight
- No SMS, no email marketing
- No insurance workflows
- No overengineering
- Every page must have loading and empty states

---

## OUTPUT RULES
- Follow this document as the source of truth
- Only implement the requested chunk
- List files changed after each chunk
- Provide exact commands to verify functionality
