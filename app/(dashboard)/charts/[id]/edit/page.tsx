import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getChartWithPhotos, getPreviousTreatment } from "@/lib/actions/charts";
import { getConsentTemplatesForClinic } from "@/lib/actions/consent";
import { getEffectiveStatus } from "@/lib/encounter-utils";
import { ChartEditor } from "./chart-editor";

export default async function ChartEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePermission("charts", "edit");
  const chart = await getChartWithPhotos(id);

  if (!chart) notFound();

  const effectiveStatus = getEffectiveStatus(chart);
  if (effectiveStatus !== "Draft") {
    const { redirect } = await import("next/navigation");
    redirect(`/charts/${id}`);
  }

  const [previousTreatment, consentTemplates, voiceDraftEnabled] = await Promise.all([
    getPreviousTreatment(chart.patientId!, chart.id, user.clinicId),
    getConsentTemplatesForClinic(user.clinicId),
    isFeatureEnabled("ai_voice_draft"),
  ]);

  return (
    <ChartEditor
      chart={chart as Parameters<typeof ChartEditor>[0]["chart"]}
      currentUserRole={user.role}
      previousTreatment={previousTreatment}
      consentTemplates={consentTemplates}
      voiceDraftEnabled={voiceDraftEnabled}
    />
  );
}
