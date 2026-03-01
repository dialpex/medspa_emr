// MappingSpec Types — The contract between AI draft and deterministic transform
// AI proposes these; humans approve; transform engine executes them.

import type { AllowedTransform } from "./transforms";
import { isAllowedTransform } from "./transforms";
import type { CanonicalEntityType } from "./schema";

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform: AllowedTransform | null;
  transformContext?: Record<string, unknown>;
  confidence: number; // 0-1
  requiresApproval: boolean; // true if confidence < 0.8
}

export interface EntityMapping {
  sourceEntity: string;
  targetEntity: CanonicalEntityType;
  fieldMappings: FieldMapping[];
  enumMaps: Record<string, Record<string, string>>; // sourceField → { sourceVal → targetVal }
}

export interface MappingSpec {
  version: number;
  sourceVendor: string;
  entityMappings: EntityMapping[];
}

// Validation

export interface MappingSpecError {
  path: string;
  message: string;
}

export function validateMappingSpec(spec: unknown): { valid: boolean; errors: MappingSpecError[] } {
  const errors: MappingSpecError[] = [];

  if (!spec || typeof spec !== "object") {
    return { valid: false, errors: [{ path: "", message: "MappingSpec must be an object" }] };
  }

  const s = spec as Record<string, unknown>;

  if (typeof s.version !== "number" || s.version < 1) {
    errors.push({ path: "version", message: "version must be a positive integer" });
  }

  if (typeof s.sourceVendor !== "string" || !s.sourceVendor) {
    errors.push({ path: "sourceVendor", message: "sourceVendor is required" });
  }

  if (!Array.isArray(s.entityMappings)) {
    errors.push({ path: "entityMappings", message: "entityMappings must be an array" });
    return { valid: false, errors };
  }

  const validEntityTypes: Set<string> = new Set([
    "patient", "appointment", "chart", "encounter",
    "consent", "photo", "document", "invoice",
  ]);

  for (let i = 0; i < s.entityMappings.length; i++) {
    const em = s.entityMappings[i] as Record<string, unknown>;
    const prefix = `entityMappings[${i}]`;

    if (typeof em.sourceEntity !== "string" || !em.sourceEntity) {
      errors.push({ path: `${prefix}.sourceEntity`, message: "sourceEntity is required" });
    }

    if (!validEntityTypes.has(em.targetEntity as string)) {
      errors.push({ path: `${prefix}.targetEntity`, message: `targetEntity must be one of: ${[...validEntityTypes].join(", ")}` });
    }

    if (!Array.isArray(em.fieldMappings)) {
      errors.push({ path: `${prefix}.fieldMappings`, message: "fieldMappings must be an array" });
      continue;
    }

    for (let j = 0; j < em.fieldMappings.length; j++) {
      const fm = em.fieldMappings[j] as Record<string, unknown>;
      const fPrefix = `${prefix}.fieldMappings[${j}]`;

      if (typeof fm.sourceField !== "string" || !fm.sourceField) {
        errors.push({ path: `${fPrefix}.sourceField`, message: "sourceField is required" });
      }
      if (typeof fm.targetField !== "string" || !fm.targetField) {
        errors.push({ path: `${fPrefix}.targetField`, message: "targetField is required" });
      }
      if (fm.transform !== null && !isAllowedTransform(fm.transform as string)) {
        errors.push({ path: `${fPrefix}.transform`, message: `Transform "${fm.transform}" is not in the allowlist` });
      }
      if (typeof fm.confidence !== "number" || fm.confidence < 0 || fm.confidence > 1) {
        errors.push({ path: `${fPrefix}.confidence`, message: "confidence must be between 0 and 1" });
      }
    }

    // Validate enumMaps
    if (em.enumMaps !== undefined && em.enumMaps !== null) {
      if (typeof em.enumMaps !== "object") {
        errors.push({ path: `${prefix}.enumMaps`, message: "enumMaps must be an object" });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
