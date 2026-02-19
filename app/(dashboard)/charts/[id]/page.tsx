import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getChartWithPhotos } from "@/lib/actions/charts";
import { getEffectiveStatus } from "@/lib/encounter-utils";
import { ChartDetail } from "./chart-detail";
import { ChartSignButton, ProviderSignButton, CoSignButton } from "./chart-sign-button";
import { AddendumSection } from "./addendum-section";
import { PageCard } from "@/components/ui/page-card";
import { prisma } from "@/lib/prisma";

export default async function ChartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePermission("charts", "view");
  const chart = await getChartWithPhotos(id);

  if (!chart) notFound();

  const effectiveStatus = getEffectiveStatus(chart);

  const canSign =
    effectiveStatus === "NeedsSignOff" &&
    !chart.providerSignedAt &&
    (user.role === "MedicalDirector" || user.role === "Owner" || user.role === "Admin");

  const canCoSign =
    effectiveStatus === "NeedsSignOff" &&
    !!chart.providerSignedAt &&
    (user.role === "MedicalDirector" || user.role === "Owner" || user.role === "Admin");

  const canEdit =
    effectiveStatus === "Draft" &&
    (user.role === "Owner" || user.role === "Admin" || user.role === "Provider");

  const canProviderSign =
    effectiveStatus === "Draft" &&
    (user.role === "Provider" || user.role === "Owner" || user.role === "Admin");

  const isFinalized = effectiveStatus === "MDSigned" && !!chart.encounterId;

  const canAddAddendum =
    isFinalized &&
    (user.role === "Provider" || user.role === "Owner" || user.role === "Admin" || user.role === "MedicalDirector");

  // Fetch addenda for finalized encounters
  let addenda: Array<{ id: string; text: string; createdAt: string; authorName: string }> = [];
  if (isFinalized && chart.encounter?.id) {
    const rawAddenda = await prisma.addendum.findMany({
      where: { encounterId: chart.encounter.id },
      orderBy: { createdAt: "asc" },
    });
    if (rawAddenda.length > 0) {
      const authorIds = [...new Set(rawAddenda.map((a) => a.authorId))];
      const authors = await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true },
      });
      const authorMap = new Map(authors.map((a) => [a.id, a.name]));
      addenda = rawAddenda.map((a) => ({
        id: a.id,
        text: a.text,
        createdAt: a.createdAt.toISOString(),
        authorName: authorMap.get(a.authorId) ?? "Unknown",
      }));
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageCard title="Chart Details">
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
          {canProviderSign && (
            <ProviderSignButton chartId={id} treatmentCards={chart.treatmentCards} />
          )}
          {canSign && <ChartSignButton chartId={id} />}
          {canCoSign && <CoSignButton chartId={id} />}
          {isFinalized && (
            <a
              href={`/api/encounters/${chart.encounterId}/export.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 border border-purple-200"
            >
              Export PDF
            </a>
          )}
        </div>
      </PageCard>

      {/* Addendum section — shown for finalized encounters */}
      {isFinalized && chart.encounter?.id && (
        <div className="mt-6">
          <AddendumSection
            encounterId={chart.encounter.id}
            initialAddenda={addenda}
            canAddAddendum={canAddAddendum}
          />
        </div>
      )}
    </div>
  );
}
