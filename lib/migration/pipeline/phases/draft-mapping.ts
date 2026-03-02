// Phase 3: Draft Mapping — SafeContext → Claude → MappingSpec draft
// Uses Anthropic SDK (direct) when ANTHROPIC_API_KEY is set,
// falls back to BedrockClaudeClient (which has its own mock fallback).

import type { SourceProfile } from "../../adapters/types";
import type { MappingSpec } from "../../canonical/mapping-spec";
import { validateMappingSpec } from "../../canonical/mapping-spec";
import { SafeContextBuilder } from "../../agent/safe-context-builder";
import { AnthropicClient } from "../../agent/anthropic-client";
import { BedrockClaudeClient } from "../../agent/bedrock-client";
import {
  MAPPING_SYSTEM_PROMPT,
  MAPPING_CORRECTION_PROMPT,
  buildMappingSystemPrompt,
} from "../../agent/prompts";
import { readMemoryForAgent } from "../../agent/mapping-memory";
import type { MappingFeedback } from "./validate";
import type { ArtifactStore, ArtifactRef } from "../../storage/types";
import type { CanonicalEntityType, CanonicalRecord } from "../../canonical/schema";
import { executeTransform } from "./transform";
import { executeValidate, buildMappingFeedback, type ValidateResult } from "./validate";

export interface DraftMappingInput {
  runId: string;
  profile: SourceProfile;
  vendor?: string;
  existingServices?: Array<{ id: string; name: string }>;
  // For dry validation (optional)
  artifacts?: ArtifactRef[];
  store?: ArtifactStore;
  tenantId?: string;
}

export interface DraftMappingResult {
  mappingSpec: MappingSpec;
  version: number;
  dryValidation?: DryValidationResult;
}

export interface DryValidationResult {
  sampleSize: number;
  predictedErrors: {
    invalidRecords: number;
    errorsByCode: Record<string, number>;
    errorsByEntity: Record<string, number>;
  };
  predictedReferentialIssues: {
    count: number;
    byEntity: Record<string, number>;
  };
  fieldPresenceStats: Record<string, Record<string, number>>;
  passed: boolean;
}

export async function executeDraftMapping(
  input: DraftMappingInput
): Promise<DraftMappingResult> {
  const builder = new SafeContextBuilder();
  const safeContext = builder.buildFromProfile(input.profile, input.existingServices);

  // Load cross-run memory for this vendor
  let memoryContext: string | undefined;
  if (input.vendor) {
    memoryContext = await readMemoryForAgent(input.vendor);
  }

  let mappingSpec: MappingSpec;

  if (AnthropicClient.isAvailable()) {
    // Use Anthropic SDK directly
    console.log(`[draft-mapping] Using Anthropic SDK (runId=${input.runId})`);
    const startTime = Date.now();

    const systemPrompt = buildMappingSystemPrompt(memoryContext);
    const client = new AnthropicClient();
    const userMessage = `Analyze this source data profile and propose field mappings to the canonical schema.\n\n${JSON.stringify(safeContext, null, 2)}`;

    mappingSpec = await client.complete<MappingSpec>(
      systemPrompt,
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

  // Run dry validation if artifacts/store/tenantId provided
  let dryValidation: DryValidationResult | undefined;
  if (input.artifacts && input.store && input.tenantId) {
    dryValidation = await runDryValidation(
      mappingSpec,
      input.vendor || mappingSpec.sourceVendor,
      input.tenantId,
      input.artifacts,
      input.store
    );
    console.log(
      `[draft-mapping] Dry validation: ${dryValidation.sampleSize} records, passed=${dryValidation.passed}`
    );
  }

  return {
    mappingSpec,
    version: mappingSpec.version,
    dryValidation,
  };
}

/**
 * AI self-correction: send current spec + validation feedback, get corrected spec.
 * Returns null if AI is unavailable (graceful degradation).
 */
export async function executeMappingCorrection(
  currentSpec: MappingSpec,
  feedback: MappingFeedback,
  profile: SourceProfile
): Promise<MappingSpec | null> {
  if (!AnthropicClient.isAvailable()) {
    console.log(`[draft-mapping] AI unavailable for correction, skipping`);
    return null;
  }

  console.log(
    `[draft-mapping] Requesting AI correction (attempt ${feedback.attempt}, ` +
      `${feedback.invalidRecords} invalid, ${feedback.referentialErrorCount} referential)`
  );

  const startTime = Date.now();
  const client = new AnthropicClient();

  const userMessage = `Fix the following MappingSpec based on the validation errors.

CURRENT MAPPING SPEC:
${JSON.stringify(currentSpec, null, 2)}

VALIDATION FEEDBACK:
${JSON.stringify(feedback, null, 2)}

SOURCE PROFILE SUMMARY:
Entities: ${profile.entities.map((e) => `${e.type} (${e.recordCount} records, fields: ${e.fields.map((f) => f.name).join(", ")})`).join("\n")}

Return the corrected MappingSpec as JSON.`;

  try {
    const correctedSpec = await client.complete<MappingSpec>(
      MAPPING_CORRECTION_PROMPT,
      userMessage,
      8192
    );

    const latencyMs = Date.now() - startTime;
    console.log(`[draft-mapping] AI correction response in ${latencyMs}ms`);

    // Validate the corrected spec structurally
    const validation = validateMappingSpec(correctedSpec);
    if (!validation.valid) {
      console.log(
        `[draft-mapping] AI returned invalid corrected spec: ${validation.errors.map((e) => e.message).join(", ")}`
      );
      return null;
    }

    return correctedSpec;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[draft-mapping] AI correction failed: ${msg}`);
    return null;
  }
}

/**
 * Dry validation: transform+validate a sample of records to predict issues
 * before human approval. Runs on first 10 records per entity.
 */
async function runDryValidation(
  mappingSpec: MappingSpec,
  vendor: string,
  tenantId: string,
  artifacts: ArtifactRef[],
  store: ArtifactStore
): Promise<DryValidationResult> {
  const SAMPLE_LIMIT = 10; // per entity type

  try {
    const transformResult = await executeTransform(
      { runId: "dry-validation", vendor, tenantId, artifacts, mappingSpec },
      store
    );

    // Sample first N records per entity type
    const countByEntity: Record<string, number> = {};
    const sampledRecords: Array<{
      entityType: CanonicalEntityType;
      canonicalId: string;
      record: CanonicalRecord;
      sourceRecordId: string;
    }> = [];

    for (const rec of transformResult.records) {
      const count = countByEntity[rec.entityType] || 0;
      if (count < SAMPLE_LIMIT) {
        sampledRecords.push({
          entityType: rec.entityType,
          canonicalId: rec.canonicalId,
          record: rec.record,
          sourceRecordId: rec.sourceRecordId,
        });
        countByEntity[rec.entityType] = count + 1;
      }
    }

    const validateResult = executeValidate({ records: sampledRecords });

    // Build field presence stats
    const fieldPresenceStats: Record<string, Record<string, number>> = {};
    for (const { entityType, record } of sampledRecords) {
      if (!fieldPresenceStats[entityType]) {
        fieldPresenceStats[entityType] = {};
      }
      const r = record as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(r)) {
        if (value !== null && value !== undefined && value !== "") {
          fieldPresenceStats[entityType][key] =
            (fieldPresenceStats[entityType][key] || 0) + 1;
        }
      }
    }

    // Referential issues by entity
    const refByEntity: Record<string, number> = {};
    for (const err of validateResult.referentialErrors) {
      refByEntity[err.entityType] = (refByEntity[err.entityType] || 0) + 1;
    }

    return {
      sampleSize: sampledRecords.length,
      predictedErrors: {
        invalidRecords: validateResult.report.invalidRecords,
        errorsByCode: validateResult.report.errorsByCode,
        errorsByEntity: validateResult.report.errorsByEntity,
      },
      predictedReferentialIssues: {
        count: validateResult.referentialErrors.length,
        byEntity: refByEntity,
      },
      fieldPresenceStats,
      passed: validateResult.passed,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[draft-mapping] Dry validation failed: ${msg}`);
    return {
      sampleSize: 0,
      predictedErrors: { invalidRecords: 0, errorsByCode: {}, errorsByEntity: {} },
      predictedReferentialIssues: { count: 0, byEntity: {} },
      fieldPresenceStats: {},
      passed: false,
    };
  }
}
