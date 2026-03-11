// Mapping Spec Diff — Detect corrections between draft and approved specs
//
// When the AI drafts a MappingSpec and it gets corrected (either by AI
// self-correction during validation or by user edits), the diff tells the
// knowledge store what the agent got wrong so it can learn.
//
// Corrections are the highest-confidence learning signal.

import type { RunOutcome } from "./types";

interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: string | null;
  transformContext?: Record<string, unknown>;
  confidence?: number;
}

interface EntityMapping {
  sourceEntity: string;
  targetEntity: string;
  fieldMappings: FieldMapping[];
  enumMaps?: Record<string, Record<string, string>>;
}

interface MappingSpecLike {
  sourceVendor?: string;
  entityMappings?: EntityMapping[];
}

export interface MappingCorrection {
  entityType: string;
  sourceField: string;
  /** What the AI originally proposed (targetField, or "unmapped" if added) */
  aiProposal: string;
  /** What the approved spec has */
  userChoice: string;
  /** What kind of correction */
  correctionType: "changed_target" | "changed_transform" | "added" | "removed";
  /** Additional context */
  details?: string;
}

/**
 * Diff two MappingSpecs to extract corrections.
 *
 * Compares field mappings between draft and approved specs.
 * Returns corrections for:
 * - Changed target fields (sourceField mapped to different target)
 * - Changed transforms (same mapping but different transform)
 * - Added mappings (in approved but not in draft)
 * - Removed mappings (in draft but not in approved)
 *
 * Does NOT flag confidence changes or reordering as corrections.
 */
export function diffMappingSpecs(
  draft: MappingSpecLike | null | undefined,
  approved: MappingSpecLike | null | undefined
): MappingCorrection[] {
  if (!draft?.entityMappings || !approved?.entityMappings) return [];

  const corrections: MappingCorrection[] = [];

  // Build lookup: sourceEntity → sourceField → FieldMapping
  const draftMap = buildFieldLookup(draft.entityMappings);
  const approvedMap = buildFieldLookup(approved.entityMappings);

  // Find changes and removals (fields in draft)
  for (const [entityKey, draftFields] of draftMap) {
    const approvedFields = approvedMap.get(entityKey);

    for (const [sourceField, draftMapping] of draftFields) {
      if (!approvedFields) {
        // Entire entity removed
        corrections.push({
          entityType: entityKey,
          sourceField,
          aiProposal: draftMapping.targetField,
          userChoice: "unmapped",
          correctionType: "removed",
          details: `Entity mapping "${entityKey}" removed entirely`,
        });
        continue;
      }

      const approvedMapping = approvedFields.get(sourceField);

      if (!approvedMapping) {
        // Field mapping removed
        corrections.push({
          entityType: entityKey,
          sourceField,
          aiProposal: draftMapping.targetField,
          userChoice: "unmapped",
          correctionType: "removed",
        });
        continue;
      }

      // Check if target field changed
      if (draftMapping.targetField !== approvedMapping.targetField) {
        corrections.push({
          entityType: entityKey,
          sourceField,
          aiProposal: draftMapping.targetField,
          userChoice: approvedMapping.targetField,
          correctionType: "changed_target",
        });
        continue;
      }

      // Check if transform changed
      const draftTransform = draftMapping.transform || null;
      const approvedTransform = approvedMapping.transform || null;
      if (draftTransform !== approvedTransform) {
        corrections.push({
          entityType: entityKey,
          sourceField,
          aiProposal: `${draftMapping.targetField}[${draftTransform || "none"}]`,
          userChoice: `${approvedMapping.targetField}[${approvedTransform || "none"}]`,
          correctionType: "changed_transform",
          details: `Transform changed from "${draftTransform}" to "${approvedTransform}"`,
        });
      }
    }
  }

  // Find additions (fields in approved but not in draft)
  for (const [entityKey, approvedFields] of approvedMap) {
    const draftFields = draftMap.get(entityKey);

    for (const [sourceField, approvedMapping] of approvedFields) {
      const wasDrafted = draftFields?.has(sourceField);
      if (!wasDrafted) {
        corrections.push({
          entityType: entityKey,
          sourceField,
          aiProposal: "unmapped",
          userChoice: approvedMapping.targetField,
          correctionType: "added",
        });
      }
    }
  }

  return corrections;
}

/**
 * Build a two-level lookup: entityKey → sourceField → FieldMapping
 * The entityKey combines sourceEntity and targetEntity for uniqueness.
 */
function buildFieldLookup(
  entityMappings: EntityMapping[]
): Map<string, Map<string, FieldMapping>> {
  const lookup = new Map<string, Map<string, FieldMapping>>();

  for (const entity of entityMappings) {
    const key = `${entity.sourceEntity}->${entity.targetEntity}`;
    let fields = lookup.get(key);
    if (!fields) {
      fields = new Map();
      lookup.set(key, fields);
    }
    for (const fm of entity.fieldMappings) {
      fields.set(fm.sourceField, fm);
    }
  }

  return lookup;
}

/**
 * Convert MappingCorrections to the RunOutcome.userCorrections format.
 */
export function correctionsToOutcome(
  corrections: MappingCorrection[]
): RunOutcome["userCorrections"] {
  return corrections.map((c) => ({
    entityType: c.entityType,
    sourceField: c.sourceField,
    aiProposal: c.aiProposal,
    userChoice: c.userChoice,
  }));
}
