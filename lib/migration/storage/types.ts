// Artifact Storage Abstraction
// All ingestion strategies output to this interface.

export interface ArtifactRef {
  runId: string;
  key: string;
  hash: string;      // SHA-256 of content
  sizeBytes: number;
  storedAt: string;   // local path or S3 URI
}

export interface ArtifactStore {
  put(runId: string, key: string, data: Buffer, metadata?: Record<string, string>): Promise<ArtifactRef>;
  get(ref: ArtifactRef): Promise<Buffer>;
  list(runId: string): Promise<ArtifactRef[]>;
  delete(runId: string): Promise<void>;
}
