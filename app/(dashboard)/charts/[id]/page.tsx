import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getChartWithPhotos } from "@/lib/actions/charts";
import { ChartDetail } from "./chart-detail";
import { ChartSignButton } from "./chart-sign-button";
import { PageCard } from "@/components/ui/page-card";

export default async function ChartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePermission("charts", "view");
  const chart = await getChartWithPhotos(id);

  if (!chart) notFound();

  const canSign =
    chart.status === "NeedsSignOff" &&
    (user.role === "MedicalDirector" || user.role === "Owner" || user.role === "Admin");

  const canEdit =
    chart.status === "Draft" &&
    (user.role === "Owner" || user.role === "Admin" || user.role === "Provider");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageCard label="Clinical" title="Chart Details">
        <ChartDetail chart={chart} />
        <div className="mt-6 flex gap-3">
          {canEdit && (
            <a
              href={`/charts/${id}/edit`}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
            >
              Edit Chart
            </a>
          )}
          {canSign && <ChartSignButton chartId={id} />}
        </div>
      </PageCard>
    </div>
  );
}
