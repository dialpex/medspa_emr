"use client";

import { useState, useTransition, useMemo } from "react";
import { DollarSign, CalendarIcon, TableIcon, BarChart3Icon } from "lucide-react";
import { getPayments, type PaymentListItem } from "@/lib/actions/payments";

type Props = { payments: PaymentListItem[] };

type ViewMode = "table" | "monthly";

type MonthData = {
  key: string;
  label: string;
  shortLabel: string;
  total: number;
  count: number;
  weeks: { label: string; total: number }[];
};

function getWeekOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  const firstDayOfWeek = firstDay.getDay();
  return Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
}

function getWeeksInMonth(year: number, month: number): number {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDay.getDay();
  return Math.ceil((lastDay.getDate() + firstDayOfWeek) / 7);
}

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

export function PaymentsView({ payments: initialPayments }: Props) {
  const [payments, setPayments] = useState(initialPayments);
  const [isPending, startTransition] = useTransition();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [method, setMethod] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  function applyFilters() {
    startTransition(async () => {
      const result = await getPayments({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        method: method || undefined,
      });
      setPayments(result);
    });
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setMethod("");
    startTransition(async () => {
      const result = await getPayments();
      setPayments(result);
    });
  }

  const hasFilters = dateFrom || dateTo || method;

  const totalGross = useMemo(
    () => payments.reduce((sum, p) => sum + p.amount, 0),
    [payments]
  );

  const monthlyData = useMemo(() => {
    const map = new Map<string, MonthData>();

    for (const p of payments) {
      const d = new Date(p.createdAt);
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;

      if (!map.has(key)) {
        const numWeeks = getWeeksInMonth(year, month);
        map.set(key, {
          key,
          label: d.toLocaleDateString("en-US", { year: "numeric", month: "long" }),
          shortLabel: d.toLocaleDateString("en-US", { month: "short" }),
          total: 0,
          count: 0,
          weeks: Array.from({ length: numWeeks }, (_, i) => ({
            label: `Week ${i + 1}`,
            total: 0,
          })),
        });
      }

      const entry = map.get(key)!;
      entry.total += p.amount;
      entry.count += 1;

      const weekIdx = getWeekOfMonth(d) - 1;
      if (weekIdx >= 0 && weekIdx < entry.weeks.length) {
        entry.weeks[weekIdx].total += p.amount;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [payments]);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthData = monthlyData.find((m) => m.key === currentMonthKey);
  const currentMonthTotal = currentMonthData?.total ?? 0;

  // For the overview bar chart, show last 12 months
  const overviewMonths = useMemo(() => {
    const months: { key: string; label: string; total: number; isCurrent: boolean; isPast: boolean }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const found = monthlyData.find((m) => m.key === key);
      months.push({
        key,
        label: d.toLocaleDateString("en-US", { month: "short" }),
        total: found?.total ?? 0,
        isCurrent: key === currentMonthKey,
        isPast: key < currentMonthKey,
      });
    }
    return months;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyData]);

  const overviewMax = useMemo(
    () => Math.max(...overviewMonths.map((m) => m.total), 1),
    [overviewMonths]
  );

  const methods = useMemo(() => {
    const set = new Set<string>();
    for (const p of initialPayments) set.add(p.paymentMethod);
    return Array.from(set).sort();
  }, [initialPayments]);

  // Y-axis ticks for overview chart
  const overviewTicks = useMemo(() => {
    const steps = 4;
    const rawStep = overviewMax / steps;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const niceStep = Math.ceil(rawStep / magnitude) * magnitude;
    const ticks: number[] = [];
    for (let i = 0; i <= steps; i++) {
      ticks.push(i * niceStep);
    }
    return ticks;
  }, [overviewMax]);

  const overviewChartMax = overviewTicks[overviewTicks.length - 1] || 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Payments</h2>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "table"
                ? "bg-purple-100 text-purple-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <TableIcon className="size-3.5" />
            Table
          </button>
          <button
            onClick={() => setViewMode("monthly")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "monthly"
                ? "bg-purple-100 text-purple-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <BarChart3Icon className="size-3.5" />
            Monthly
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <div className="relative">
            <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-300 pl-8 pr-3 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <div className="relative">
            <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-300 pl-8 pr-3 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="">All methods</option>
            {methods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={applyFilters}
          disabled={isPending}
          className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {isPending ? "Loading..." : "Apply"}
        </button>
        {hasFilters && (
          <button
            onClick={clearFilters}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Clear
          </button>
        )}
        <div className="ml-auto text-sm text-gray-500">
          <span className="font-medium text-gray-900">{payments.length}</span> payments
          {" · "}
          Total: <span className="font-semibold text-gray-900">${totalGross.toFixed(2)}</span>
        </div>
      </div>

      {/* Table View */}
      {viewMode === "table" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {payments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <DollarSign className="size-8 mx-auto mb-2 text-gray-300" />
              No payments found for the selected filters.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Invoice #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Patient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Method</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reference</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.invoice.invoiceNumber}</td>
                    <td className="px-4 py-3 text-gray-900">{p.invoice.patient.firstName} {p.invoice.patient.lastName}</td>
                    <td className="px-4 py-3 text-gray-600">{p.paymentMethod}</td>
                    <td className="px-4 py-3 text-gray-500">{p.reference || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">${p.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Monthly Breakdown View */}
      {viewMode === "monthly" && (
        <div className="space-y-6">
          {/* Hero earnings section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 pb-2">
            <p className="text-sm font-medium text-gray-500 mb-1">Earnings</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              You&apos;ve made{" "}
              <span className="text-purple-600">
                ${currentMonthTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>{" "}
              this month
            </p>

            {/* Monthly bar chart */}
            <div className="mt-8">
              <div className="relative h-48">
                {/* Y-axis grid lines and labels */}
                {overviewTicks.map((tick) => (
                  <div
                    key={tick}
                    className="absolute left-0 right-0 flex items-center"
                    style={{ bottom: `${(tick / overviewChartMax) * 100}%` }}
                  >
                    <span className="text-xs text-gray-400 w-10 text-right mr-3 -translate-y-1/2">
                      {formatCurrency(tick)}
                    </span>
                    <div className="flex-1 border-t border-gray-100" />
                  </div>
                ))}

                {/* Bars */}
                <div className="absolute left-14 right-0 bottom-0 top-0 flex items-end gap-1">
                  {overviewMonths.map((m) => {
                    const height = overviewChartMax > 0 ? (m.total / overviewChartMax) * 100 : 0;
                    const isPast = m.isPast;
                    const isCurrent = m.isCurrent;

                    return (
                      <div key={m.key} className="flex-1 flex flex-col items-center">
                        <div className="w-full relative" style={{ height: "192px" }}>
                          <div
                            className={`absolute bottom-0 left-1 right-1 rounded-t transition-all ${
                              isPast || isCurrent
                                ? "bg-purple-500"
                                : "border-2 border-gray-200 bg-white"
                            }`}
                            style={{ height: `${Math.max(height, 1)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Month labels */}
              <div className="flex ml-14 mt-2 gap-1">
                {overviewMonths.map((m) => (
                  <div key={m.key} className="flex-1 text-center">
                    {m.isCurrent ? (
                      <span className="inline-flex items-center justify-center rounded-full bg-gray-900 px-2 py-0.5 text-xs font-medium text-white">
                        {m.label}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">{m.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Monthly cards with weekly breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monthlyData.map((m) => {
              const weekMax = Math.max(...m.weeks.map((w) => w.total), 1);

              return (
                <div
                  key={m.key}
                  className="bg-white rounded-xl border border-gray-200 p-5"
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <h3 className="font-semibold text-gray-900">{m.label}</h3>
                    {m.key === currentMonthKey && (
                      <span className="text-xs font-medium text-purple-600 bg-purple-50 rounded-full px-2 py-0.5">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    ${m.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    {m.count} payment{m.count !== 1 ? "s" : ""}
                  </p>

                  {/* Weekly bar chart */}
                  <div className="flex items-end gap-2 h-20">
                    {m.weeks.map((w, i) => {
                      const height = weekMax > 0 ? (w.total / weekMax) * 100 : 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full relative h-16">
                            <div
                              className={`absolute bottom-0 left-0 right-0 rounded-t transition-all ${
                                w.total > 0
                                  ? m.key === currentMonthKey
                                    ? "bg-purple-500"
                                    : "bg-purple-300"
                                  : "bg-gray-100"
                              }`}
                              style={{ height: `${Math.max(height, 4)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400">W{i + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {monthlyData.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
              <BarChart3Icon className="size-8 mx-auto mb-2 text-gray-300" />
              No payment data to display.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
