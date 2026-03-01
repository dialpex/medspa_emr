// Phase 5: Transform — Apply approved MappingSpec to produce canonical staging records

import { createHash } from "crypto";
import type { ArtifactStore, ArtifactRef } from "../../storage/types";
import type { MappingSpec } from "../../canonical/mapping-spec";
import type { CanonicalRecord, CanonicalEntityType } from "../../canonical/schema";
import { createAdapter } from "../../adapters";

export interface TransformInput {
  runId: string;
  vendor: string;
  tenantId: string;
  artifacts: ArtifactRef[];
  mappingSpec: MappingSpec;
}

export interface TransformResult {
  records: Array<{
    entityType: CanonicalEntityType;
    canonicalId: string;
    record: CanonicalRecord;
    checksum: string;
    sourceRecordId: string;
  }>;
  counts: Record<string, number>;
}

export async function executeTransform(
  input: TransformInput,
  store: ArtifactStore
): Promise<TransformResult> {
  const adapter = createAdapter(input.vendor, input.tenantId);
  const results: TransformResult["records"] = [];
  const counts: Record<string, number> = {};

  for await (const { entityType, record } of adapter.transform(
    input.artifacts,
    store,
    input.mappingSpec
  )) {
    const canonical = record as Record<string, unknown>;
    const canonicalId = canonical.canonicalId as string;
    const sourceRecordId = canonical.sourceRecordId as string;
    const checksum = createHash("sha256")
      .update(JSON.stringify(record))
      .digest("hex");

    results.push({
      entityType,
      canonicalId,
      record,
      checksum,
      sourceRecordId,
    });

    counts[entityType] = (counts[entityType] || 0) + 1;
  }

  return { records: results, counts };
}
