// Local filesystem artifact store for development
// Production uses S3ArtifactStore with SSE-KMS encryption

import { createHash } from "crypto";
import { mkdir, writeFile, readFile, readdir, rm, stat } from "fs/promises";
import path from "path";
import type { ArtifactRef, ArtifactStore } from "./types";

const DEFAULT_BASE_DIR = "storage/migration";

export class LocalArtifactStore implements ArtifactStore {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || DEFAULT_BASE_DIR;
  }

  private runDir(runId: string): string {
    return path.join(this.baseDir, runId);
  }

  private artifactPath(runId: string, key: string): string {
    // Sanitize key to be safe for filesystem
    const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, "_");
    return path.join(this.runDir(runId), safeKey);
  }

  async put(
    runId: string,
    key: string,
    data: Buffer,
    metadata?: Record<string, string>
  ): Promise<ArtifactRef> {
    const dir = this.runDir(runId);
    await mkdir(dir, { recursive: true });

    const filePath = this.artifactPath(runId, key);
    await writeFile(filePath, data);

    // Store metadata as sidecar JSON if provided
    if (metadata && Object.keys(metadata).length > 0) {
      await writeFile(`${filePath}.meta.json`, JSON.stringify(metadata));
    }

    const hash = createHash("sha256").update(data).digest("hex");

    return {
      runId,
      key,
      hash,
      sizeBytes: data.length,
      storedAt: filePath,
    };
  }

  async get(ref: ArtifactRef): Promise<Buffer> {
    return readFile(ref.storedAt);
  }

  async list(runId: string): Promise<ArtifactRef[]> {
    const dir = this.runDir(runId);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }

    const refs: ArtifactRef[] = [];
    for (const entry of entries) {
      if (entry.endsWith(".meta.json")) continue;

      const filePath = path.join(dir, entry);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) continue;

      const data = await readFile(filePath);
      const hash = createHash("sha256").update(data).digest("hex");

      refs.push({
        runId,
        key: entry,
        hash,
        sizeBytes: data.length,
        storedAt: filePath,
      });
    }

    return refs;
  }

  async delete(runId: string): Promise<void> {
    const dir = this.runDir(runId);
    await rm(dir, { recursive: true, force: true });
  }
}
