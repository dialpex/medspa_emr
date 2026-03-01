// Phase 3: Draft Mapping — SafeContext → Bedrock → MappingSpec draft

import type { SourceProfile } from "../../adapters/types";
import type { MappingSpec } from "../../canonical/mapping-spec";
import { SafeContextBuilder } from "../../agent/safe-context-builder";
import { BedrockClaudeClient } from "../../agent/bedrock-client";

export interface DraftMappingInput {
  runId: string;
  profile: SourceProfile;
  existingServices?: Array<{ id: string; name: string }>;
}

export interface DraftMappingResult {
  mappingSpec: MappingSpec;
  version: number;
}

export async function executeDraftMapping(
  input: DraftMappingInput
): Promise<DraftMappingResult> {
  const builder = new SafeContextBuilder();
  const safeContext = builder.buildFromProfile(input.profile, input.existingServices);

  const client = new BedrockClaudeClient();
  const mappingSpec = await client.proposeMappingSpec(safeContext, input.runId);

  return {
    mappingSpec,
    version: mappingSpec.version,
  };
}
