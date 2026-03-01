// PHI Redactor — Strips patient data from GraphQL responses before Claude sees them.
// Claude only sees: field names, types, array lengths, __typename, pagination metadata.
// Raw string values, numbers, and IDs are redacted.

const SAFE_KEYS = new Set([
  "__typename",
  "hasNextPage",
  "hasPreviousPage",
  "totalCount",
  "totalEntries",
  "total",
  "pageInfo",
  "cursor",
  "startCursor",
  "endCursor",
]);

const ID_PATTERNS = /^(id|.*Id|.*_id)$/i;

/**
 * Redact PHI from a GraphQL response structure.
 * Preserves schema shape (field names, types, nesting) but replaces values.
 */
export function redactPHI(data: unknown, depth = 0): unknown {
  if (depth > 20) return "[max depth]";

  if (data === null || data === undefined) return data;

  if (typeof data === "boolean") return data;

  if (typeof data === "number") {
    return 0;
  }

  if (typeof data === "string") {
    // Preserve __typename values — they're schema metadata, not PHI
    return `[string len=${data.length}]`;
  }

  if (Array.isArray(data)) {
    return {
      __redacted_array: true,
      length: data.length,
      sample: data.slice(0, 2).map((item) => redactPHI(item, depth + 1)),
    };
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (key === "__typename") {
        // Preserve __typename — it's GraphQL schema info, not PHI
        result[key] = value;
        continue;
      }

      if (SAFE_KEYS.has(key)) {
        // Pagination/count metadata is safe
        result[key] = typeof value === "object" ? redactPHI(value, depth + 1) : value;
        continue;
      }

      if (ID_PATTERNS.test(key)) {
        result[key] = "[id]";
        continue;
      }

      // Recurse into nested objects
      result[key] = redactPHI(value, depth + 1);
    }

    return result;
  }

  return "[unknown]";
}

/**
 * Redact a GraphQL error response — keep error messages (they contain
 * schema info like field/type names) but strip any paths that might leak data.
 */
export function redactGraphQLErrors(
  errors: Array<{ message: string; path?: unknown[]; extensions?: unknown }>
): Array<{ message: string }> {
  return errors.map((e) => ({ message: e.message }));
}
