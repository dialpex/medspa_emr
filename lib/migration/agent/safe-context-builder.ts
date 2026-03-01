// SafeContext Builder — PHI Masking Layer
// Only SafeContext (field names, types, distributions, masked shapes) crosses to Claude.
// Raw values NEVER leave Neuvvia-controlled storage.

import { createHmac } from "crypto";
import type { SourceProfile } from "../adapters/types";
import type { CanonicalSchemaDescription } from "../canonical/schema";
import { CANONICAL_SCHEMA_DESCRIPTION } from "../canonical/schema";

export interface SafeContext {
  sourceProfile: SourceProfile;
  targetSchema: CanonicalSchemaDescription;
  existingServices?: Array<{ id: string; name: string }>;
}

// Masking functions

function getMaskingSecret(): string {
  return process.env.MIGRATION_MASKING_SECRET || "dev-masking-secret";
}

export function maskString(value: string): string {
  return `[string len=${value.length}]`;
}

export function maskDate(_value: string): string {
  return "[date]";
}

export function maskFreeText(value: string): string {
  return `[text redacted len=${value.length}]`;
}

export function maskIdentifier(value: string): string {
  const secret = getMaskingSecret();
  return createHmac("sha256", secret).update(value).digest("hex").substring(0, 16);
}

export class SafeContextBuilder {
  buildFromProfile(
    profile: SourceProfile,
    existingServices?: Array<{ id: string; name: string }>
  ): SafeContext {
    // Profile is already non-PHI (field names, types, distributions only)
    // Verify no raw values leaked into profile
    const sanitized = this.sanitizeProfile(profile);

    return {
      sourceProfile: sanitized,
      targetSchema: CANONICAL_SCHEMA_DESCRIPTION,
      existingServices,
    };
  }

  private sanitizeProfile(profile: SourceProfile): SourceProfile {
    // Extra safety: ensure sampleDistribution contains no actual values
    return {
      ...profile,
      entities: profile.entities.map((entity) => ({
        ...entity,
        fields: entity.fields.map((field) => ({
          ...field,
          // Strip any sample values that might have leaked
          sampleDistribution: field.sampleDistribution
            ? this.sanitizeDistribution(field.sampleDistribution)
            : undefined,
        })),
      })),
    };
  }

  private sanitizeDistribution(dist: string): string {
    // Only allow statistical descriptions, not actual values
    // Pattern: "N/M non-null, K unique" or similar statistical summaries
    if (/^\d+\/\d+ non-null, ~?\d+ unique/.test(dist)) {
      return dist;
    }
    // Strip anything that doesn't look like a statistical summary
    const match = dist.match(/(\d+)\s*(?:\/\s*(\d+))?\s*non-null.*?(\d+)\s*unique/);
    if (match) {
      return `${match[1]}/${match[2] || "?"} non-null, ${match[3]} unique`;
    }
    return "[distribution available]";
  }
}
