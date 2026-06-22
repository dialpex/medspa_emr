import type {
  PatientServiceProfile,
  OverdueService,
  FrequentService,
  SuggestedCombo,
  UpsellSuggestion,
} from "./types";

interface AppointmentRecord {
  startTime: Date;
  serviceName: string | null;
  status: string;
}

const COMPLEMENTARY_SERVICES: Record<string, { name: string; reason: string }[]> = {
  botox: [
    { name: "Dermal Filler", reason: "Combine neuromodulator with filler for a full-face rejuvenation" },
    { name: "Chemical Peel", reason: "Enhance skin texture between neurotoxin appointments" },
  ],
  filler: [
    { name: "Botox", reason: "Pair filler with neurotoxin for comprehensive anti-aging" },
    { name: "PRP Facial", reason: "PRP can enhance skin quality alongside filler results" },
  ],
  facial: [
    { name: "Chemical Peel", reason: "Step up from basic facials for deeper exfoliation" },
    { name: "Microneedling", reason: "Amplify collagen production beyond what facials achieve" },
  ],
  laser: [
    { name: "IPL", reason: "Address pigmentation alongside laser treatments" },
    { name: "Hydrafacial", reason: "Soothe and hydrate skin between laser sessions" },
  ],
  microneedling: [
    { name: "PRP", reason: "Add PRP to microneedling for enhanced collagen stimulation" },
  ],
};

function normalizeServiceName(name: string): string {
  return name.toLowerCase().trim();
}

function findComplementaryKey(serviceName: string): string | null {
  const normalized = normalizeServiceName(serviceName);
  for (const key of Object.keys(COMPLEMENTARY_SERVICES)) {
    if (normalized.includes(key)) return key;
  }
  return null;
}

export function analyzeServiceHistory(appointments: AppointmentRecord[]): PatientServiceProfile {
  const completed = appointments.filter(
    (a) => a.serviceName && (a.status === "Completed" || a.status === "CheckedIn")
  );

  if (completed.length === 0) {
    return { overdueServices: [], frequentServices: [], suggestedCombos: [] };
  }

  // Group by service name
  const serviceGroups = new Map<string, Date[]>();
  for (const apt of completed) {
    const name = apt.serviceName!;
    const dates = serviceGroups.get(name) || [];
    dates.push(new Date(apt.startTime));
    serviceGroups.set(name, dates);
  }

  const overdueServices: OverdueService[] = [];
  const frequentServices: FrequentService[] = [];
  const now = new Date();

  for (const [serviceName, dates] of serviceGroups) {
    dates.sort((a, b) => a.getTime() - b.getTime());

    if (dates.length >= 2) {
      // Calculate average interval
      let totalInterval = 0;
      for (let i = 1; i < dates.length; i++) {
        totalInterval += dates[i].getTime() - dates[i - 1].getTime();
      }
      const avgIntervalMs = totalInterval / (dates.length - 1);
      const avgIntervalDays = Math.round(avgIntervalMs / (1000 * 60 * 60 * 24));

      const lastDate = dates[dates.length - 1];
      const daysSinceLast = Math.round(
        (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      frequentServices.push({
        serviceName,
        visitCount: dates.length,
        avgIntervalDays,
      });

      // Flag as overdue if > 1.2x the average interval
      if (daysSinceLast > avgIntervalDays * 1.2) {
        overdueServices.push({
          serviceName,
          lastDate: lastDate.toISOString(),
          avgIntervalDays,
          daysSinceLast,
        });
      }
    }
  }

  // Sort by urgency (most overdue first)
  overdueServices.sort((a, b) => {
    const ratioA = a.daysSinceLast / a.avgIntervalDays;
    const ratioB = b.daysSinceLast / b.avgIntervalDays;
    return ratioB - ratioA;
  });

  // Find complementary service suggestions
  const suggestedCombos: SuggestedCombo[] = [];
  const patientServiceNames = new Set(
    [...serviceGroups.keys()].map(normalizeServiceName)
  );

  for (const serviceName of serviceGroups.keys()) {
    const key = findComplementaryKey(serviceName);
    if (!key) continue;
    const combos = COMPLEMENTARY_SERVICES[key];
    for (const combo of combos) {
      // Only suggest if the patient hasn't already had this service
      const alreadyHas = [...patientServiceNames].some((s) =>
        s.includes(normalizeServiceName(combo.name))
      );
      if (!alreadyHas) {
        // Avoid duplicates
        if (!suggestedCombos.some((s) => normalizeServiceName(s.serviceName) === normalizeServiceName(combo.name))) {
          suggestedCombos.push({ serviceName: combo.name, reason: combo.reason });
        }
      }
    }
  }

  return { overdueServices, frequentServices, suggestedCombos };
}

export function profileToSuggestions(profile: PatientServiceProfile): UpsellSuggestion[] {
  const suggestions: UpsellSuggestion[] = [];

  for (const overdue of profile.overdueServices.slice(0, 2)) {
    const ratio = overdue.daysSinceLast / overdue.avgIntervalDays;
    suggestions.push({
      title: `${overdue.serviceName} — Overdue`,
      reason: `Last visit was ${overdue.daysSinceLast} days ago (usually every ${overdue.avgIntervalDays} days)`,
      urgency: ratio > 2 ? "high" : "medium",
    });
  }

  for (const combo of profile.suggestedCombos.slice(0, 2)) {
    suggestions.push({
      title: `Try ${combo.serviceName}`,
      reason: combo.reason,
      urgency: "low",
    });
  }

  return suggestions.slice(0, 3);
}
