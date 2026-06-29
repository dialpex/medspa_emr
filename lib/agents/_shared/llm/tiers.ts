// Tiered model routing — config-driven model selection by task complexity.

export type ModelTier = "triage" | "executor" | "supervisor";

const TIER_DEFAULTS: Record<ModelTier, string> = {
  triage: "claude-haiku-4-5-20251001",
  executor: "claude-sonnet-4-5-20250929",
  supervisor: "claude-sonnet-4-5-20250929",
};

const TIER_ENV_KEYS: Record<ModelTier, string> = {
  triage: "LLM_TIER_TRIAGE",
  executor: "LLM_TIER_EXECUTOR",
  supervisor: "LLM_TIER_SUPERVISOR",
};

export function getModelForTier(tier: ModelTier): string {
  return process.env[TIER_ENV_KEYS[tier]] || TIER_DEFAULTS[tier];
}
