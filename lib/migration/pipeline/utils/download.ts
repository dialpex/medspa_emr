// File download utility for migration promote phase.
// Downloads photos, documents, and signatures from vendor URLs to local storage.

import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function downloadFile(
  url: string,
  destPath: string
): Promise<{ sizeBytes: number; mimeType: string | null }> {
  const dir = path.dirname(destPath);
  await mkdir(dir, { recursive: true });

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buffer);

  return {
    sizeBytes: buffer.length,
    mimeType: res.headers.get("content-type"),
  };
}
