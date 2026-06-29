import { getLLMProvider, completionWithRetry } from "@/lib/agents/_shared/llm";
import type { PatientServiceProfile, UpsellSuggestion } from "./types";

export async function generateLLMSuggestions(
  profile: PatientServiceProfile
): Promise<UpsellSuggestion[]> {
  const provider = getLLMProvider();

  const system = `You are a medical aesthetics practice advisor. Given a patient's anonymized service history profile, suggest 2-3 actionable recommendations for the practice to offer this patient. Focus on timing, complementary treatments, and patient retention. Return ONLY a JSON object: { "suggestions": [{ "title": string, "reason": string, "urgency": "high"|"medium"|"low" }] }`;

  const userMessage = `Patient service profile (anonymized — no patient identifiers):

Overdue services: ${JSON.stringify(profile.overdueServices.map((s) => ({ service: s.serviceName, daysSinceLast: s.daysSinceLast, usualInterval: s.avgIntervalDays })))}

Frequent services: ${JSON.stringify(profile.frequentServices.map((s) => ({ service: s.serviceName, visits: s.visitCount, avgIntervalDays: s.avgIntervalDays })))}

Complementary suggestions already identified: ${JSON.stringify(profile.suggestedCombos.map((s) => s.serviceName))}

Generate 2-3 smart, concise suggestions.`;

  const { result } = await completionWithRetry<{ suggestions: UpsellSuggestion[] }>(
    provider,
    system,
    userMessage,
    { temperature: 0.7 },
    (parsed) => {
      if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        return { valid: false, error: "Must have a suggestions array" };
      }
      if (parsed.suggestions.length === 0) {
        return { valid: false, error: "Must have at least one suggestion" };
      }
      for (const s of parsed.suggestions) {
        if (!s.title || !s.reason || !["high", "medium", "low"].includes(s.urgency)) {
          return { valid: false, error: "Each suggestion needs title, reason, and urgency (high/medium/low)" };
        }
      }
      return { valid: true };
    }
  );

  return result.suggestions.slice(0, 2);
}
