# Migration Agent — HIPAA Compliance

## PHI Boundary

The migration agent enforces a strict PHI boundary:

### What crosses to the AI model (SafeContext only)
- Field names (e.g., "firstName", "email", "appointmentDate")
- Inferred data types ("string", "date", "number", "email")
- Statistical distributions ("95% non-null, ~200 unique values")
- Null rates and uniqueness rates
- Relationship hints between entities

### What NEVER crosses to the AI model
- Patient names, emails, phone numbers, addresses
- Dates of birth, SSNs, insurance info
- Medical notes, allergies, diagnoses
- Any raw field values
- Photo/document binary data

## Masking Rules

| Data Type | Masking Output |
|-----------|---------------|
| String values | `[string len=N]` |
| Dates | `[date]` |
| Free text | `[text redacted len=N]` |
| Identifiers | HMAC-SHA256 hash (16 chars) |

## Browser Automation PHI Safety

When using Stagehand for browser automation:
- Browser runs **server-side only** on Neuvvia infrastructure
- Credentials encrypted at rest with AES-256-GCM
- Stagehand's AI sees DOM structure for navigation, NOT field values
- Extracted values go directly to the ArtifactStore
- Browser session destroyed after extraction
- Every page visited and extraction action is audit-logged

## Encryption

- Credentials: AES-256-GCM (`MIGRATION_ENCRYPTION_KEY` env var)
- Artifacts at rest: Local filesystem (dev), S3 with SSE-KMS (prod)
- Masking secret: `MIGRATION_MASKING_SECRET` env var

## Audit Trail

Every phase transition creates a `MigrationAuditEvent` with:
- Phase name
- Action (e.g., `PHASE_STARTED`, `MAPPING_APPROVED`, `VALIDATION_FAILED`)
- Actor ID (user or "system")
- Non-PHI metadata (counts, error codes, timestamps)

## Access Control

- Only the **Owner** role can create, view, or manage migrations
- All API routes enforce `requirePermission("migration", "create")`
