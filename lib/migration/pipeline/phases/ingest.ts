// Phase 1: Ingest — Accept data from any ingestion strategy
// All strategies output to the same ArtifactStore.

import type { ArtifactStore } from "../../storage/types";
import type { ArtifactRef } from "../../storage/types";
import type { MigrationProvider, MigrationCredentials } from "../../providers/types";
import type { IngestStrategy, RawRecord } from "../../ingest/types";
import { resolveStrategy } from "../../ingest/strategy-resolver";
import { StagehandBrowserAgent } from "../../ingest/browser-agent";
import { AnthropicClient } from "../../agent/anthropic-client";
import { AgentEnhancedProvider } from "../../agent/enhanced-provider";
import { BoulevardProvider } from "../../providers/boulevard";

export interface IngestInput {
  runId: string;
  vendor: string;
  strategy?: IngestStrategy; // override auto-detection
  credentials?: MigrationCredentials;
  encryptedCredentials?: string;
  emrUrl?: string;
  uploadedFiles?: Array<{ key: string; data: Buffer }>;
  patientLimit?: number; // cap patient ingestion (saves API credits)
}

export interface IngestResult {
  strategy: IngestStrategy;
  artifacts: ArtifactRef[];
  entityCounts: Record<string, number>;
}

export async function executeIngest(
  input: IngestInput,
  store: ArtifactStore,
  provider?: MigrationProvider
): Promise<IngestResult> {
  const strategy = input.strategy || resolveStrategy({
    vendor: input.vendor,
    hasCredentials: !!(input.credentials || input.encryptedCredentials),
    hasUploadedFiles: !!(input.uploadedFiles && input.uploadedFiles.length > 0),
    emrUrl: input.emrUrl,
  });

  const artifacts: ArtifactRef[] = [];
  const entityCounts: Record<string, number> = {};

  switch (strategy) {
    case "upload":
      return executeUploadIngest(input, store);

    case "api":
      return executeApiIngest(input, store, provider!);

    case "browser":
      return executeBrowserIngest(input, store);
  }
}

async function executeUploadIngest(
  input: IngestInput,
  store: ArtifactStore
): Promise<IngestResult> {
  const artifacts: ArtifactRef[] = [];
  const entityCounts: Record<string, number> = {};

  if (!input.uploadedFiles || input.uploadedFiles.length === 0) {
    throw new Error("Upload strategy requires uploaded files");
  }

  for (const file of input.uploadedFiles) {
    const ref = await store.put(input.runId, file.key, file.data);
    artifacts.push(ref);

    // Count records
    const content = file.data.toString("utf-8");
    if (file.key.endsWith(".json")) {
      const parsed = JSON.parse(content);
      entityCounts[file.key] = Array.isArray(parsed) ? parsed.length : 1;
    } else {
      // CSV: count lines minus header
      const lines = content.split(/\r?\n/).filter((l) => l.trim());
      entityCounts[file.key] = Math.max(0, lines.length - 1);
    }
  }

  return { strategy: "upload", artifacts, entityCounts };
}

async function executeApiIngest(
  input: IngestInput,
  store: ArtifactStore,
  baseProvider: MigrationProvider
): Promise<IngestResult> {
  const artifacts: ArtifactRef[] = [];
  const entityCounts: Record<string, number> = {};
  const creds = input.credentials!;

  // Wrap with agent-enhanced provider if available
  let provider = baseProvider;
  if (AnthropicClient.isAvailable() && baseProvider instanceof BoulevardProvider) {
    console.log(`  [ingest] Wrapping ${baseProvider.source} with AgentEnhancedProvider`);
    const enhanced = new AgentEnhancedProvider({
      baseProvider,
      getExecutor: () => baseProvider.getGraphQLExecutor(),
      getSeedQueries: () => baseProvider.getSeedQueries(),
    });
    await enhanced.initialize(creds);
    provider = enhanced;
  }

  const perPatient = new Set(provider.perPatientEntities || []);

  console.log(`  [ingest] vendor=${input.vendor} credentials=${creds ? "present" : "MISSING"} perPatient=[${[...perPatient].join(",")}]`);

  // --- Step 1: Fetch top-level entities (paginated) ---

  // Always fetch patients first — needed for per-patient entity fetching
  const allPatients = await fetchAllPaginated(provider, "fetchPatients", creds, input.patientLimit);
  if (allPatients.length > 0) {
    const data = Buffer.from(JSON.stringify(allPatients, null, 2));
    const ref = await store.put(input.runId, "patients.json", data);
    artifacts.push(ref);
    entityCounts.patients = allPatients.length;
  }

  // Top-level entities (not per-patient)
  const topLevelFetchers: Array<{ name: string; method: string }> = [
    { name: "services", method: "fetchServices" },
    { name: "appointments", method: "fetchAppointments" },
    { name: "invoices", method: "fetchInvoices" },
  ];

  // Optional top-level entities
  if (provider.fetchCharts && !perPatient.has("charts")) {
    topLevelFetchers.push({ name: "charts", method: "fetchCharts" });
  }
  if (provider.fetchPhotos && !perPatient.has("photos")) {
    topLevelFetchers.push({ name: "photos", method: "fetchPhotos" });
  }
  if (provider.fetchForms && !perPatient.has("forms")) {
    topLevelFetchers.push({ name: "forms", method: "fetchForms" });
  }
  if (provider.fetchDocuments && !perPatient.has("documents")) {
    topLevelFetchers.push({ name: "documents", method: "fetchDocuments" });
  }

  for (const fetcher of topLevelFetchers) {
    const records = await fetchAllPaginated(provider, fetcher.method, creds);
    if (records.length > 0) {
      const data = Buffer.from(JSON.stringify(records, null, 2));
      const ref = await store.put(input.runId, `${fetcher.name}.json`, data);
      artifacts.push(ref);
      entityCounts[fetcher.name] = records.length;
    }
  }

  // --- Step 2: Fetch per-patient entities ---
  // Some providers (e.g., Boulevard) scope photos/forms/docs to a patient ID.
  // We iterate all patients and aggregate results.

  if (perPatient.size > 0 && allPatients.length > 0) {
    const patientIds = allPatients.map(
      (p) => (p as Record<string, unknown>).sourceId as string
    );

    for (const entityType of perPatient) {
      const methodName = `fetch${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`;
      const fetchFn = (provider as unknown as Record<string, Function>)[methodName];
      if (!fetchFn) continue;

      const allRecords: unknown[] = [];
      let fetched = 0;

      for (const patientId of patientIds) {
        // Per-patient entities use cursor to pass the patient ID
        let cursor: string = entityType === "documents" && provider.locationId
          ? `${patientId}:${provider.locationId}`
          : patientId;

        const result = await fetchFn.call(provider, creds, { cursor });
        if (result.data?.length > 0) {
          allRecords.push(...result.data);
          fetched++;
        }
      }

      if (allRecords.length > 0) {
        const data = Buffer.from(JSON.stringify(allRecords, null, 2));
        const ref = await store.put(input.runId, `${entityType}.json`, data);
        artifacts.push(ref);
        entityCounts[entityType] = allRecords.length;
        console.log(`  [ingest] ${entityType}: ${allRecords.length} records from ${fetched}/${patientIds.length} patients`);
      }
    }
  }

  return { strategy: "api", artifacts, entityCounts };
}

/** Paginate through all records for a top-level fetcher */
async function fetchAllPaginated(
  provider: MigrationProvider,
  methodName: string,
  creds: MigrationCredentials,
  limit?: number
): Promise<unknown[]> {
  const fetchFn = (provider as unknown as Record<string, Function>)[methodName];
  if (!fetchFn) {
    console.log(`  [ingest] ${methodName}: method not found on provider`);
    return [];
  }

  const allRecords: unknown[] = [];
  let cursor: string | undefined;
  let page = 0;

  try {
    do {
      const result = await fetchFn.call(
        provider,
        creds,
        cursor ? { cursor } : undefined
      );
      allRecords.push(...result.data);
      cursor = result.nextCursor;
      page++;

      // Stop early if we've hit the limit
      if (limit && allRecords.length >= limit) {
        allRecords.length = limit; // truncate to exact limit
        break;
      }
    } while (cursor);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  [ingest] ${methodName} failed on page ${page}: ${msg}`);
  }

  const limitNote = limit ? ` [limit: ${limit}]` : "";
  console.log(`  [ingest] ${methodName}: ${allRecords.length} records (${page} pages)${limitNote}`);
  return allRecords;
}

async function executeBrowserIngest(
  input: IngestInput,
  store: ArtifactStore
): Promise<IngestResult> {
  if (!input.encryptedCredentials || !input.emrUrl) {
    throw new Error("Browser strategy requires encrypted credentials and EMR URL");
  }

  const agent = new StagehandBrowserAgent(input.vendor);
  const artifacts: ArtifactRef[] = [];
  const entityCounts: Record<string, number> = {};

  try {
    await agent.connect({ ciphertext: input.encryptedCredentials }, input.emrUrl);
    const discovered = await agent.discoverEntities();

    // Extract each available entity type
    const extractors: Array<{
      type: string;
      extract: () => AsyncGenerator<RawRecord | { metadata: RawRecord; binary: Buffer }>;
      isBinary: boolean;
    }> = [
      { type: "patients", extract: () => agent.extractPatients(), isBinary: false },
      { type: "appointments", extract: () => agent.extractAppointments(), isBinary: false },
      { type: "charts", extract: () => agent.extractCharts(), isBinary: false },
      { type: "consents", extract: () => agent.extractConsents(), isBinary: false },
      { type: "photos", extract: () => agent.extractPhotos(), isBinary: true },
      { type: "documents", extract: () => agent.extractDocuments(), isBinary: true },
    ];

    for (const ext of extractors) {
      const entity = discovered.find((d) => d.entityType === ext.type);
      if (!entity?.available) continue;

      const records: Record<string, unknown>[] = [];

      for await (const item of ext.extract()) {
        if (ext.isBinary) {
          const binaryItem = item as { metadata: RawRecord; binary: Buffer };
          // Store binary artifact separately
          const binaryKey = `${ext.type}/${binaryItem.metadata.sourceId}`;
          await store.put(input.runId, binaryKey, binaryItem.binary);
          records.push(binaryItem.metadata.data);
        } else {
          records.push((item as RawRecord).data);
        }
      }

      if (records.length > 0) {
        const data = Buffer.from(JSON.stringify(records, null, 2));
        const ref = await store.put(input.runId, `${ext.type}.json`, data);
        artifacts.push(ref);
        entityCounts[ext.type] = records.length;
      }
    }

    // Store audit log
    const auditData = Buffer.from(JSON.stringify(agent.getAuditLog(), null, 2));
    await store.put(input.runId, "_browser_audit.json", auditData);

    return { strategy: "browser", artifacts, entityCounts };
  } finally {
    await agent.close();
  }
}
