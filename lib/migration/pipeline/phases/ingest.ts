// Phase 1: Ingest — Accept data from any ingestion strategy
// All strategies output to the same ArtifactStore.

import type { ArtifactStore } from "../../storage/types";
import type { ArtifactRef } from "../../storage/types";
import type { MigrationProvider, MigrationCredentials } from "../../providers/types";
import type { IngestStrategy, RawRecord } from "../../ingest/types";
import { resolveStrategy } from "../../ingest/strategy-resolver";
import { StagehandBrowserAgent } from "../../ingest/browser-agent";

export interface IngestInput {
  runId: string;
  vendor: string;
  strategy?: IngestStrategy; // override auto-detection
  credentials?: MigrationCredentials;
  encryptedCredentials?: string;
  emrUrl?: string;
  uploadedFiles?: Array<{ key: string; data: Buffer }>;
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
  provider: MigrationProvider
): Promise<IngestResult> {
  const artifacts: ArtifactRef[] = [];
  const entityCounts: Record<string, number> = {};
  const creds = input.credentials!;

  // Fetch each entity type and store as JSON artifacts
  const entityFetchers: Array<{
    name: string;
    fetch: () => Promise<{ data: unknown[]; nextCursor?: string }>;
  }> = [
    { name: "patients", fetch: () => provider.fetchPatients(creds) },
    { name: "services", fetch: () => provider.fetchServices(creds) },
    { name: "appointments", fetch: () => provider.fetchAppointments(creds) },
    { name: "invoices", fetch: () => provider.fetchInvoices(creds) },
  ];

  // Optional entity types
  if (provider.fetchPhotos) {
    entityFetchers.push({ name: "photos", fetch: () => provider.fetchPhotos!(creds) });
  }
  if (provider.fetchForms) {
    entityFetchers.push({ name: "forms", fetch: () => provider.fetchForms!(creds) });
  }
  if (provider.fetchCharts) {
    entityFetchers.push({ name: "charts", fetch: () => provider.fetchCharts!(creds) });
  }
  if (provider.fetchDocuments) {
    entityFetchers.push({ name: "documents", fetch: () => provider.fetchDocuments!(creds) });
  }

  for (const fetcher of entityFetchers) {
    const allRecords: unknown[] = [];
    let cursor: string | undefined;

    // Paginate through all records
    do {
      const result = await (cursor
        ? (provider as Record<string, Function>)[`fetch${fetcher.name.charAt(0).toUpperCase() + fetcher.name.slice(1)}`](creds, { cursor })
        : fetcher.fetch());
      allRecords.push(...result.data);
      cursor = result.nextCursor;
    } while (cursor);

    if (allRecords.length > 0) {
      const data = Buffer.from(JSON.stringify(allRecords, null, 2));
      const ref = await store.put(input.runId, `${fetcher.name}.json`, data);
      artifacts.push(ref);
      entityCounts[fetcher.name] = allRecords.length;
    }
  }

  return { strategy: "api", artifacts, entityCounts };
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
