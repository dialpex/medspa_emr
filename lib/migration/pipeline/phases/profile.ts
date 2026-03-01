// Phase 2: Profile — Produce a SourceProfile (non-PHI) from artifacts

import type { ArtifactStore, ArtifactRef } from "../../storage/types";
import type { SourceProfile } from "../../adapters/types";
import { createAdapter } from "../../adapters";

export interface ProfileInput {
  runId: string;
  vendor: string;
  tenantId: string;
  artifacts: ArtifactRef[];
}

export interface ProfileResult {
  profile: SourceProfile;
}

export async function executeProfile(
  input: ProfileInput,
  store: ArtifactStore
): Promise<ProfileResult> {
  const adapter = createAdapter(input.vendor, input.tenantId);
  const profile = await adapter.profile(input.artifacts, store);

  return { profile };
}
