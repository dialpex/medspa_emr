# Migration Runbook

## Prerequisites

- Owner-level access to Neuvvia
- Source EMR credentials (for API/browser strategies) or exported files
- `MIGRATION_ENCRYPTION_KEY` environment variable set (32 bytes)
- `MIGRATION_MASKING_SECRET` environment variable set
- For Bedrock AI: `AWS_REGION` and `BEDROCK_MODEL_ID` env vars (falls back to mock if unavailable)

## Running a Migration

### 1. Create a Run

```bash
curl -X POST /api/internal/migrations/runs \
  -H "Content-Type: application/json" \
  -d '{"sourceVendor": "csv", "consentText": "I authorize..."}'
```

### 2. Ingest Data

For file upload, first upload files via `/api/migration/csv-upload`, then:

```bash
curl -X POST /api/internal/migrations/runs/{id}/ingest \
  -H "Content-Type: application/json" \
  -d '{}'
```

For API-based ingestion, provide credentials in the request body.

### 3. Profile

```bash
curl -X POST /api/internal/migrations/runs/{id}/profile
```

Review the returned `SourceProfile` to verify entity detection and PHI classification.

### 4. Draft Mapping

```bash
curl -X POST /api/internal/migrations/runs/{id}/draft-mapping
```

Review the returned `MappingSpec`. Check confidence scores and fields marked `requiresApproval: true`.

### 5. Approve Mapping

```bash
curl -X POST /api/internal/migrations/runs/{id}/approve-mapping
```

### 6. Transform + Validate + Load + Finalize

```bash
curl -X POST /api/internal/migrations/runs/{id}/transform
curl -X POST /api/internal/migrations/runs/{id}/validate
curl -X POST /api/internal/migrations/runs/{id}/load
curl -X POST /api/internal/migrations/runs/{id}/finalize
```

### 7. Review Report

```bash
curl GET /api/internal/migrations/runs/{id}/report
```

## Troubleshooting

| Issue | Resolution |
|-------|-----------|
| Validation failed | Check error codes in report; fix source data or adjust mapping |
| Browser agent can't connect | Verify credentials; check if EMR URL is accessible |
| Bedrock unavailable | System falls back to mock mapping; approve and adjust manually |
| Duplicate patients | Review dedup results in report; merge manually if needed |
| Pipeline stuck | Check `currentPhase` and `errorMessage` on the run |
