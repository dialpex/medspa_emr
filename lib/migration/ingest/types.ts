// Multi-Strategy Ingestion Types

export type IngestStrategy = "browser" | "api" | "upload";

export interface EntityDiscovery {
  entityType: string;
  available: boolean;
  estimatedCount?: number;
  accessMethod: string; // "navigation", "api", "file"
}

export interface EncryptedCredentials {
  ciphertext: string; // AES-256-GCM encrypted
}

export interface IngestProgress {
  strategy: IngestStrategy;
  entitiesDiscovered: EntityDiscovery[];
  entitiesExtracted: Record<string, number>;
  currentEntity?: string;
  phase: "connecting" | "discovering" | "extracting" | "complete" | "failed";
  errorMessage?: string;
}

// Browser Ingest Agent interface — implemented by Stagehand wrapper
export interface BrowserIngestAgent {
  connect(credentials: EncryptedCredentials, emrUrl: string): Promise<void>;
  discoverEntities(): Promise<EntityDiscovery[]>;
  extractPatients(): AsyncGenerator<RawRecord>;
  extractAppointments(): AsyncGenerator<RawRecord>;
  extractCharts(): AsyncGenerator<RawRecord>;
  extractConsents(): AsyncGenerator<RawRecord>;
  extractPhotos(): AsyncGenerator<{ metadata: RawRecord; binary: Buffer }>;
  extractDocuments(): AsyncGenerator<{ metadata: RawRecord; binary: Buffer }>;
  close(): Promise<void>;
}

export interface RawRecord {
  sourceId: string;
  entityType: string;
  data: Record<string, unknown>;
  extractedAt: string;
}

// Audit event for browser automation
export interface BrowserAuditEntry {
  timestamp: string;
  action: string; // "navigate", "extract", "download", "click"
  url?: string;
  entityType?: string;
  recordCount?: number;
  durationMs?: number;
}
