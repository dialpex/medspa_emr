# MappingSpec Reference

## Overview

A `MappingSpec` defines how source data fields map to Neuvvia's canonical data model. It is proposed by Claude (via Bedrock) and must be approved by a human before execution.

## Structure

```typescript
interface MappingSpec {
  version: number;           // Incrementing version per run
  sourceVendor: string;      // e.g., "boulevard", "csv"
  entityMappings: EntityMapping[];
}

interface EntityMapping {
  sourceEntity: string;      // Source entity name
  targetEntity: string;      // Canonical entity type
  fieldMappings: FieldMapping[];
  enumMaps: Record<string, Record<string, string>>;
}

interface FieldMapping {
  sourceField: string;       // Field in source data
  targetField: string;       // Field in canonical type
  transform: AllowedTransform | null;
  confidence: number;        // 0-1, set by AI
  requiresApproval: boolean; // true if confidence < 0.8
}
```

## Allowed Transforms

Only these transforms can be used — no arbitrary code:

| Transform | Description |
|-----------|-------------|
| `normalizeDate` | Parse various date formats → ISO 8601 |
| `normalizePhone` | Strip formatting → E.164 (+1XXXXXXXXXX) |
| `normalizeEmail` | Trim + lowercase |
| `trim` | Remove leading/trailing whitespace |
| `toUpper` | Uppercase |
| `toLower` | Lowercase |
| `mapEnum` | Map source enum value via enumMaps |
| `splitName` | Split "First Last" → individual components |
| `concat` | Concatenate multiple fields |
| `defaultValue` | Use fallback if null/empty |
| `hashToken` | HMAC-SHA256 hash (for tokens/IDs) |

## Validation

`validateMappingSpec()` checks:
- version is a positive integer
- sourceVendor is a non-empty string
- entityMappings is an array with valid entries
- targetEntity is a valid canonical entity type
- All transforms are in the allowlist
- Confidence scores are between 0 and 1

## Approval Gate

The pipeline **cannot proceed** past `approve_mapping` without:
1. A valid mapping spec (version > 0)
2. Explicit human approval via `POST /runs/:id/approve-mapping`
3. Audit event: `MAPPING_APPROVED` with approver ID
