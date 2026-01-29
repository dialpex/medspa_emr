import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getChartWithPhotos } from "@/lib/actions/charts";
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

  if (chart.status === "MDSigned") {
    const { redirect } = await import("next/navigation");
    redirect(`/charts/${id}`);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ChartEditor chart={chart} currentUserRole={user.role} />
    </div>
  );
}
