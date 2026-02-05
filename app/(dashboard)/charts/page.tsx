import { requirePermission } from "@/lib/rbac";
import { getCharts } from "@/lib/actions/charts";
import { ChartList } from "./chart-list";
import { PageCard } from "@/components/ui/page-card";

export default async function ChartsPage() {
  await requirePermission("charts", "view");
  const charts = await getCharts();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageCard label="Clinical" title="Charts">
        <ChartList initialCharts={charts} />
      </PageCard>
    </div>
  );
}
