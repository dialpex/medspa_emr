import { readJSON, writeJSON, isStale } from "@/lib/agents/_shared/memory/base";
import { join } from "path";
import { mkdir } from "fs/promises";
import { analyzeServiceHistory, profileToSuggestions } from "./analyzer";
import { generateLLMSuggestions } from "./generator";
import type { UpsellSuggestion } from "./types";

export type { UpsellSuggestion } from "./types";

const CACHE_DIR = join(process.cwd(), "storage/cache/upsell");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedSuggestions {
  timestamp: string;
  suggestions: UpsellSuggestion[];
}

function cacheKey(patientId: string): string {
  return join(CACHE_DIR, `${patientId}.json`);
}

interface AppointmentInput {
  startTime: Date;
  status: string;
  service: { name: string } | null;
}

export async function getSuggestions(
  patientId: string,
  appointments: AppointmentInput[]
): Promise<UpsellSuggestion[]> {
  // Check cache
  const cached = await readJSON<CachedSuggestions>(cacheKey(patientId));
  if (cached && !isStale(cached.timestamp, CACHE_TTL_MS)) {
    return cached.suggestions;
  }

  // Build appointment records
  const records = appointments.map((a) => ({
    startTime: a.startTime,
    serviceName: a.service?.name ?? null,
    status: a.status,
  }));

  const profile = analyzeServiceHistory(records);

  let suggestions: UpsellSuggestion[];

  // Use LLM only for complex cases
  const isComplex = profile.overdueServices.length >= 2 || appointments.length > 10;
  if (isComplex) {
    try {
      suggestions = await generateLLMSuggestions(profile);
    } catch {
      // Fallback to heuristic suggestions if LLM fails
      suggestions = profileToSuggestions(profile);
    }
  } else {
    suggestions = profileToSuggestions(profile);
  }

  // Cache results
  if (suggestions.length > 0) {
    try {
      await mkdir(CACHE_DIR, { recursive: true });
      await writeJSON(cacheKey(patientId), {
        timestamp: new Date().toISOString(),
        suggestions,
      });
    } catch {
      // Cache write failure is non-critical
    }
  }

  return suggestions;
}
