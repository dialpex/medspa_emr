export type JourneyPhase = "upcoming" | "here" | "with_provider" | "done";

export function derivePhase(apt: {
  checkedInAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
}): JourneyPhase {
  if (apt.completedAt) return "done";
  if (apt.startedAt) return "with_provider";
  if (apt.checkedInAt) return "here";
  return "upcoming";
}
