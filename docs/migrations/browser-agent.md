# Browser Ingestion Agent

## Overview

The Browser Ingestion Agent uses Stagehand (by Browserbase) — a TypeScript AI browser automation framework built on Playwright — to extract data from source EMRs that don't offer APIs.

## How It Works

1. Clinic provides their EMR credentials (encrypted at rest)
2. Stagehand launches a headless browser server-side
3. AI navigates the source EMR dashboard using natural language directives
4. Structured data is extracted page by page using `extract()` with Zod schemas
5. Photos and documents are downloaded as binary artifacts
6. Everything is stored in the ArtifactStore
7. Browser session is destroyed

## PHI Safety

- **Server-side only**: Browser never runs client-side
- **Credentials encrypted**: AES-256-GCM at rest
- **AI sees DOM, not values**: Stagehand's LLM analyzes DOM structure to plan navigation; extracted VALUES go directly to artifact storage
- **No caching**: `enableCaching: false` prevents PHI from being cached
- **Audit trail**: Every page visit and extraction action is logged

## Vendor Scripts

Vendor-specific navigation scripts provide hints to Stagehand for known EMRs:

```
lib/migration/ingest/vendors/
  types.ts          — VendorNavigationScript interface
  boulevard.ts      — Boulevard dashboard navigation
  generic.ts        — Fallback: pure AI-guided exploration
```

### Adding a Vendor Script

1. Create `lib/migration/ingest/vendors/your-emr.ts`
2. Implement the `VendorNavigationScript` interface
3. Add a case to `loadVendorScript()` in `browser-agent.ts`

Optional methods:
- `login()` — Custom login flow
- `discoverEntities()` — Map sidebar sections to entity types
- `extractEntity()` — Custom extraction per entity type
- `extractPhotos()` — Binary photo extraction
- `extractDocuments()` — Binary document extraction

## Dependencies

Stagehand is an **optional dependency**. If not installed, the browser agent throws a clear error message. Install with:

```bash
npm install @browserbasehq/stagehand
```
