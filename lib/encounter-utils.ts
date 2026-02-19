/**
 * Maps encounter status to the display values used by the UI's STATUS_STYLES / STATUS_LABELS.
 * When an encounter exists, its status is the source of truth.
 * Falls back to chart.status for legacy charts without an encounter.
 */
export function getEffectiveStatus(chart: {
  status: string;
  encounter?: { status: string } | null;
}): string {
  if (chart.encounter) {
    const map: Record<string, string> = {
      Draft: "Draft",
      PendingReview: "NeedsSignOff",
      Finalized: "MDSigned",
    };
    return map[chart.encounter.status] ?? chart.status;
  }
  return chart.status;
}
