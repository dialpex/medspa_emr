import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageCard } from "@/components/ui/page-card";
import { ShieldCheckIcon } from "lucide-react";

export default async function MDReviewPage() {
  const user = await requirePermission("charts", "sign");

  const charts = await prisma.chart.findMany({
    where: {
      clinicId: user.clinicId,
      status: "NeedsSignOff",
      deletedAt: null,
      providerSignedAt: { not: null },
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      providerSignedBy: { select: { name: true } },
      appointment: { select: { service: { select: { name: true } } } },
    },
    orderBy: { providerSignedAt: "asc" },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageCard title="MD Review Queue">
        {charts.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheckIcon className="size-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No charts pending review</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="pb-3 font-medium text-gray-500">Patient</th>
                  <th className="pb-3 font-medium text-gray-500">Provider</th>
                  <th className="pb-3 font-medium text-gray-500">Service</th>
                  <th className="pb-3 font-medium text-gray-500">Signed At</th>
                  <th className="pb-3 font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {charts.map((chart) => (
                  <tr key={chart.id} className="hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">
                      {chart.patient?.firstName} {chart.patient?.lastName}
                    </td>
                    <td className="py-3 text-gray-600">
                      {chart.providerSignedBy?.name ?? "—"}
                    </td>
                    <td className="py-3 text-gray-600">
                      {chart.appointment?.service?.name ?? "—"}
                    </td>
                    <td className="py-3 text-gray-600">
                      {chart.providerSignedAt
                        ? new Date(chart.providerSignedAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/charts/${chart.id}`}
                        className="text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageCard>
    </div>
  );
}
