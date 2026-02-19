import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getChartWithPhotos } from "@/lib/actions/charts";
import { getEffectiveStatus } from "@/lib/encounter-utils";
import { ChartEditor } from "./chart-editor";
import { PageCard } from "@/components/ui/page-card";

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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageCard title="Edit Chart">
        <ChartEditor chart={chart} currentUserRole={user.role} />
      </PageCard>
    </div>
  );
}
