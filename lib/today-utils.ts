export type JourneyPhase = "upcoming" | "here" | "with_provider" | "done" | "no_show" | "cancelled";

export function derivePhase(apt: {
  status: string;
  checkedInAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
}): JourneyPhase {
  if (apt.status === "NoShow") return "no_show";
  if (apt.status === "Cancelled") return "cancelled";
  if (apt.completedAt) return "done";
  if (apt.startedAt) return "with_provider";
  if (apt.checkedInAt) return "here";
  return "upcoming";
}
