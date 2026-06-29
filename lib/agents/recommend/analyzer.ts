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
    { name: "Skincare Serum Replenishment", reason: "It's been 2 months since her last skincare serum — time to replenish for optimal results between treatments" },
    { name: "Chemical Peel", reason: "Enhance skin texture between neurotoxin appointments" },
  ],
  filler: [
    { name: "Botox", reason: "Pair filler with neurotoxin for comprehensive anti-aging" },
    { name: "PRP Facial", reason: "PRP can enhance skin quality alongside filler results" },
  ],
  facial: [
    { name: "Chemical Peel", reason: "Step up from basic facials for deeper exfoliation" },
    { name: "Microneedling", reason: "Amplify collagen production beyond what facials achieve" },
    { name: "Medical-Grade Skincare", reason: "Extend facial results at home with a personalized skincare regimen" },
  ],
  laser: [
    { name: "IPL", reason: "Address pigmentation alongside laser treatments" },
    { name: "Hydrafacial", reason: "Soothe and hydrate skin between laser sessions" },
  ],
  microneedling: [
    { name: "PRP", reason: "Add PRP to microneedling for enhanced collagen stimulation" },
    { name: "Medical-Grade Skincare", reason: "Support collagen recovery with targeted serums and growth factors" },
  ],
  // BHRT / Hormone therapy
  pellet: [
    { name: "Lab Panel", reason: "Routine labs ensure hormone levels are optimized before next pellet insertion" },
    { name: "Weight Management Consult", reason: "Hormone optimization pairs well with a structured weight management plan" },
    { name: "Peptide Therapy", reason: "Peptides can complement hormone therapy for energy, recovery, and body composition" },
  ],
  bhrt: [
    { name: "Lab Panel", reason: "Monitor hormone levels to fine-tune BHRT dosing" },
    { name: "Peptide Therapy", reason: "Peptides support the anti-aging and recovery benefits of hormone therapy" },
    { name: "IV Therapy", reason: "Micronutrient infusions support hormonal balance and overall wellness" },
  ],
  hormone: [
    { name: "Lab Panel", reason: "Follow-up labs are essential for safe, effective hormone management" },
    { name: "Weight Management Consult", reason: "Hormone changes often impact metabolism — proactive weight support improves outcomes" },
  ],
  // IV Therapy
  iv: [
    { name: "IV Membership", reason: "Regular IV therapy patients benefit from membership pricing and scheduled sessions" },
    { name: "Peptide Therapy", reason: "Combine IV micronutrients with peptides for enhanced recovery and performance" },
    { name: "Lab Panel", reason: "Baseline labs help tailor IV formulations to actual nutrient deficiencies" },
  ],
  drip: [
    { name: "IV Membership", reason: "Lock in recurring drip sessions with a membership for consistency and savings" },
    { name: "Vitamin Injection", reason: "Quick vitamin shots between drip sessions maintain nutrient levels" },
  ],
  // Skincare
  skincare: [
    { name: "Chemical Peel", reason: "In-office peels accelerate results from a home skincare routine" },
    { name: "Microneedling", reason: "Microneedling boosts product penetration and collagen for better skincare outcomes" },
    { name: "Hydrafacial", reason: "Deep cleansing and infusion complement daily skincare products" },
  ],
  // Weight management
  "weight loss": [
    { name: "Lab Panel", reason: "Metabolic labs help personalize the weight management approach" },
    { name: "Peptide Therapy", reason: "Peptides like BPC-157 or semaglutide support weight management goals" },
    { name: "IV Therapy", reason: "Lipotropic and nutrient IVs support metabolism during weight loss" },
    { name: "BHRT Consult", reason: "Hormonal imbalances can stall weight loss — a BHRT evaluation may help" },
  ],
  semaglutide: [
    { name: "Lab Panel", reason: "Monitor metabolic markers while on GLP-1 therapy" },
    { name: "IV Therapy", reason: "Nutrient support helps offset potential deficiencies during weight loss" },
    { name: "Body Contouring", reason: "Non-invasive body contouring complements weight loss for stubborn areas" },
  ],
  tirzepatide: [
    { name: "Lab Panel", reason: "Track metabolic health and adjust dosing with routine labs" },
    { name: "IV Therapy", reason: "Hydration and nutrient IVs support patients on GLP-1 medications" },
    { name: "Body Contouring", reason: "Sculpt and tighten as the body composition changes with treatment" },
  ],
  // Peptide therapy
  peptide: [
    { name: "Lab Panel", reason: "Labs help track biomarkers and validate peptide therapy outcomes" },
    { name: "IV Therapy", reason: "IV micronutrients complement peptide protocols for optimal results" },
    { name: "BHRT Consult", reason: "Peptides and hormones work synergistically for anti-aging and performance" },
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

      // Flag as overdue if past the average interval
      if (daysSinceLast > avgIntervalDays) {
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
    const isNeuromodulator = normalizeServiceName(overdue.serviceName).includes("botox") ||
      normalizeServiceName(overdue.serviceName).includes("dysport") ||
      normalizeServiceName(overdue.serviceName).includes("xeomin") ||
      normalizeServiceName(overdue.serviceName).includes("jeuveau");
    suggestions.push({
      title: isNeuromodulator
        ? "Neuromodulator Treatment Due"
        : `${overdue.serviceName} — Overdue`,
      reason: isNeuromodulator
        ? `Due for next neuromodulator treatment — last session was ${overdue.daysSinceLast} days ago (usually every ${overdue.avgIntervalDays} days)`
        : `Last visit was ${overdue.daysSinceLast} days ago (usually every ${overdue.avgIntervalDays} days)`,
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

  return suggestions.slice(0, 2);
}
