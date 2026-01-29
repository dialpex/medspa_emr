"use client";

import { useState } from "react";
import Link from "next/link";
import { PlusIcon, FileTextIcon } from "lucide-react";

type ChartItem = {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  chiefComplaint: string | null;
  patient: { firstName: string; lastName: string };
  createdBy: { name: string };
  template: { name: string } | null;
  appointment: { startTime: Date; service: { name: string } | null } | null;
};

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  NeedsSignOff: "bg-amber-50 text-amber-700",
  MDSigned: "bg-green-50 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  Draft: "Draft",
  NeedsSignOff: "Needs Sign-off",
  MDSigned: "Signed",
};

export function ChartList({ initialCharts }: { initialCharts: ChartItem[] }) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const filtered = initialCharts.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${c.patient.firstName} ${c.patient.lastName}`.toLowerCase();
      return name.includes(q) || c.createdBy.name.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Charts</h1>
        <Link
          href="/charts/new"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
        >
          <PlusIcon className="size-4" />
          New Chart
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patient or provider..."
          className="flex-1 max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="NeedsSignOff">Needs Sign-off</option>
          <option value="MDSigned">Signed</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileTextIcon className="size-8 mx-auto mb-2 text-gray-300" />
            No charts found.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Template</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Provider</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((chart) => (
                <tr key={chart.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {chart.patient.firstName} {chart.patient.lastName}
                    </div>
                    {chart.chiefComplaint && (
                      <div className="text-xs text-gray-500 truncate max-w-xs">
                        {chart.chiefComplaint}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {chart.template?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {chart.createdBy.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                        STATUS_STYLES[chart.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABELS[chart.status] ?? chart.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(chart.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={
                        chart.status === "Draft"
                          ? `/charts/${chart.id}/edit`
                          : `/charts/${chart.id}`
                      }
                      className="text-sm text-purple-600 hover:text-purple-700"
                    >
                      {chart.status === "Draft" ? "Edit" : "View"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
