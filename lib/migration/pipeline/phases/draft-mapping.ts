// Phase 3: Draft Mapping — SafeContext → Claude → MappingSpec draft
// Uses Anthropic SDK (direct) when ANTHROPIC_API_KEY is set,
// falls back to BedrockClaudeClient (which has its own mock fallback).

import type { SourceProfile } from "../../adapters/types";
import type { MappingSpec } from "../../canonical/mapping-spec";
import { validateMappingSpec } from "../../canonical/mapping-spec";
import { SafeContextBuilder } from "../../agent/safe-context-builder";
import { AnthropicClient } from "../../agent/anthropic-client";
import { BedrockClaudeClient } from "../../agent/bedrock-client";
import { MAPPING_SYSTEM_PROMPT } from "../../agent/prompts";

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

  let mappingSpec: MappingSpec;

  if (AnthropicClient.isAvailable()) {
    // Use Anthropic SDK directly
    console.log(`[draft-mapping] Using Anthropic SDK (runId=${input.runId})`);
    const startTime = Date.now();

    const client = new AnthropicClient();
    const userMessage = `Analyze this source data profile and propose field mappings to the canonical schema.\n\n${JSON.stringify(safeContext, null, 2)}`;

    mappingSpec = await client.complete<MappingSpec>(
      MAPPING_SYSTEM_PROMPT,
      userMessage,
      8192
    );

    const latencyMs = Date.now() - startTime;
    console.log(`[draft-mapping] Anthropic response in ${latencyMs}ms`);

    // Validate
    const validation = validateMappingSpec(mappingSpec);
    if (!validation.valid) {
      throw new Error(
        `Invalid MappingSpec from Anthropic: ${validation.errors.map((e) => e.message).join(", ")}`
      );
    }
  } else {
    // Fall back to Bedrock (which itself falls back to mock)
    console.log(`[draft-mapping] ANTHROPIC_API_KEY not set, falling back to Bedrock/mock`);
    const client = new BedrockClaudeClient();
    mappingSpec = await client.proposeMappingSpec(safeContext, input.runId);
  }

  return {
    mappingSpec,
    version: mappingSpec.version,
  };
}
