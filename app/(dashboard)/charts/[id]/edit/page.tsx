import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getChartWithPhotos, getPreviousTreatment } from "@/lib/actions/charts";
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

  const previousTreatment = await getPreviousTreatment(
    chart.patientId!,
    chart.id,
    user.clinicId
  );

  return (
    <ChartEditor
      chart={chart as Parameters<typeof ChartEditor>[0]["chart"]}
      currentUserRole={user.role}
      previousTreatment={previousTreatment}
    />
  );
}
