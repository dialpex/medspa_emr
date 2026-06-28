import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getChartWithPhotos, getPreviousTreatment } from "@/lib/actions/charts";
import { getEffectiveStatus } from "@/lib/encounter-utils";
import { ChartEditor } from "./chart-editor";
import { Breadcrumbs, buildBreadcrumbItems } from "@/components/ui/breadcrumbs";

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

  const patientName = chart.patient
    ? `${chart.patient.firstName} ${chart.patient.lastName}`
    : "Patient";

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 pt-4">
        <Breadcrumbs items={buildBreadcrumbItems(
          { label: "Patient Directory", href: "/patients" },
          { label: patientName, href: chart.patientId ? `/patients/${chart.patientId}` : undefined },
          { label: "Edit Chart" }
        )} />
      </div>
      <ChartEditor
        chart={chart as Parameters<typeof ChartEditor>[0]["chart"]}
        currentUserRole={user.role}
        previousTreatment={previousTreatment}
      />
    </div>
  );
}
