// Vendor Adapter Interface
// Adapters profile and transform artifacts that were ingested from any source.
// They work on stored artifacts, NOT live data.

import type { ArtifactRef } from "../storage/types";
import type { ArtifactStore } from "../storage/types";
import type { MappingSpec } from "../canonical/mapping-spec";
import type { CanonicalRecord, CanonicalEntityType } from "../canonical/schema";

// Source profile — non-PHI summary of ingested data
export interface SourceFieldProfile {
  name: string;
  inferredType: "string" | "date" | "number" | "email" | "phone" | "enum" | "boolean" | "unknown";
  nullRate: number;
  uniqueRate: number;
  sampleDistribution?: string; // e.g., "95% non-null, ~200 unique values"
  isPHI: boolean; // heuristic classification
}

export interface RelationshipHint {
  field: string;
  targetEntity: string;
  targetField: string;
  confidence: number;
}

export interface SourceEntityProfile {
  type: string;           // "patients", "appointments", etc.
  source: string;         // filename or API entity name
  recordCount: number;
  fields: SourceFieldProfile[];
  keyCandidates: string[];
  relationshipHints: RelationshipHint[];
}

export interface SourceProfile {
  entities: SourceEntityProfile[];
  phiClassification: Record<string, Record<string, boolean>>; // entity → field → isPHI
}

// Adapter interface
export interface VendorAdapter {
  profile(artifacts: ArtifactRef[], store: ArtifactStore): Promise<SourceProfile>;
  transform(
    artifacts: ArtifactRef[],
    store: ArtifactStore,
    mappingSpec: MappingSpec
  ): AsyncGenerator<{ entityType: CanonicalEntityType; record: CanonicalRecord }>;
}
