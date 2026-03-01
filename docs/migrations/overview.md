# Migration Agent V1 — Overview

## What It Does

The Neuvvia Migration Agent imports clinical data from any source EMR into Neuvvia. It handles the full lifecycle: ingestion, profiling, AI-assisted field mapping, human approval, transformation, validation, loading, and reconciliation.

## Architecture

```
Ingest → Profile → Draft Mapping → Approve → Transform → Validate → Load → Reconcile
  ↓         ↓           ↓              ↓          ↓           ↓         ↓        ↓
Artifacts  Source     SafeContext    Human     Canonical   Hard-stop  Staging  Final
stored     Profile    → Bedrock     gate      records     checks     → Prod   report
```

## Three Ingestion Strategies

1. **Browser Automation** (Stagehand + Playwright) — For EMRs without APIs. The agent navigates the source EMR's UI and extracts data.
2. **API Providers** — For EMRs with known APIs (e.g., Boulevard GraphQL).
3. **File Upload** — For CSV/JSON/FHIR exports.

All strategies output to the same `ArtifactStore`, making downstream processing uniform.

## AI Model

Claude via AWS Bedrock. Only receives SafeContext (field names, types, distributions). **No PHI ever reaches the model.**

## Key Design Decisions

- **Phased pipeline**: Each phase is independently resumable
- **Human approval gate**: Mapping spec must be approved before transform
- **Deterministic validators**: The model is advisory; validators are the authority
- **Staging-first load**: Records go to staging tables before promotion to domain tables
- **Idempotent upserts**: Deterministic canonical IDs via `hash(tenantId + vendorKey + sourceId)`
- **Audit trail**: Every phase transition logged to `MigrationAuditEvent`

## File Structure

```
lib/migration/
  canonical/          — Canonical types, validators, transforms, mapping spec
  storage/            — ArtifactStore (local filesystem / S3)
  agent/              — Bedrock client, SafeContext builder, prompts
  ingest/             — Browser agent, strategy resolver, vendor scripts
  adapters/           — VendorAdapter interface, GenericCSVAdapter
  providers/          — Live API fetchers (Boulevard, Mock)
  pipeline/           — Orchestrator + 8 phase implementations
    phases/           — ingest, profile, draft-mapping, transform, validate, load, reconcile

app/api/internal/migrations/runs/  — REST API routes
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/runs` | Create a new migration run |
| GET    | `/runs` | List migration runs |
| POST   | `/runs/:id/ingest` | Trigger ingestion phase |
| POST   | `/runs/:id/profile` | Run profiling phase |
| POST   | `/runs/:id/draft-mapping` | Generate AI mapping draft |
| POST   | `/runs/:id/approve-mapping` | Approve mapping (human gate) |
| POST   | `/runs/:id/transform` | Transform to canonical records |
| POST   | `/runs/:id/validate` | Run deterministic validation |
| POST   | `/runs/:id/load` | Load to staging + promote |
| POST   | `/runs/:id/finalize` | Reconcile + complete |
| GET    | `/runs/:id/report` | Get migration report |

## RBAC

Only the **Owner** role has migration permissions. All other roles are denied by default.
