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
