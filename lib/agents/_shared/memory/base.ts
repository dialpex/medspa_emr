// Shared memory utilities — file-based JSON cache helpers.
// Used by schema-cache, mapping-memory, and discovery-memory.

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const CACHE_BASE = join(process.cwd(), ".migration-cache");

export function vendorDir(vendor: string): string {
  return join(CACHE_BASE, vendor.toLowerCase().replace(/[^a-z0-9]/g, "-"));
}

export function sharedDir(): string {
  return join(CACHE_BASE, "_shared");
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function readJSON<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeJSON(path: string, data: unknown): Promise<void> {
  const dir = path.substring(0, path.lastIndexOf("/"));
  await ensureDir(dir);
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}

export function isStale(timestamp: string, maxAgeMs: number): boolean {
  const age = Date.now() - new Date(timestamp).getTime();
  return age > maxAgeMs;
}
