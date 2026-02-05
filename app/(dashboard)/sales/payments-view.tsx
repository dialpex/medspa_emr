"use client";

import { useState, useTransition, useMemo } from "react";
import {
  DollarSign,
  CalendarIcon,
  TableIcon,
  BarChart3Icon,
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowRightIcon,
  ReceiptTextIcon,
} from "lucide-react";
import { PageCard } from "@/components/ui/page-card";
import { getPayments, type PaymentListItem } from "@/lib/actions/payments";

type Props = { payments: PaymentListItem[] };

type ViewMode = "table" | "monthly";

type MonthData = {
  key: string;
  label: string;
  shortLabel: string;
  total: number;
  count: number;
  avgPerTransaction: number;
  weeks: { label: string; total: number; count: number }[];
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

function formatCompact(amount: number): string {
  if (amount >= 10000) return `$${(amount / 1000).toFixed(0)}K`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
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
          avgPerTransaction: 0,
          weeks: Array.from({ length: numWeeks }, (_, i) => ({
            label: `Week ${i + 1}`,
            total: 0,
            count: 0,
          })),
        });
      }

      const entry = map.get(key)!;
      entry.total += p.amount;
      entry.count += 1;

      const weekIdx = getWeekOfMonth(d) - 1;
      if (weekIdx >= 0 && weekIdx < entry.weeks.length) {
        entry.weeks[weekIdx].total += p.amount;
        entry.weeks[weekIdx].count += 1;
      }
    }

    for (const entry of map.values()) {
      entry.avgPerTransaction = entry.count > 0 ? entry.total / entry.count : 0;
    }

    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [payments]);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthData = monthlyData.find((m) => m.key === currentMonthKey);
  const currentMonthTotal = currentMonthData?.total ?? 0;
  const currentMonthCount = currentMonthData?.count ?? 0;
  const currentMonthAvg = currentMonthData?.avgPerTransaction ?? 0;

  // Previous month for comparison
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  const prevMonthData = monthlyData.find((m) => m.key === prevMonthKey);
  const prevMonthTotal = prevMonthData?.total ?? 0;
  const revenueChange = pctChange(currentMonthTotal, prevMonthTotal);

  // For the overview chart, show last 12 months
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

  // SVG area chart points
  const chartPoints = useMemo(() => {
    const padding = 0;
    const w = 100;
    const h = 100;
    return overviewMonths.map((m, i) => ({
      x: padding + (i / (overviewMonths.length - 1)) * (w - padding * 2),
      y: h - (overviewMax > 0 ? (m.total / overviewMax) * (h - 10) : 0) - 5,
      ...m,
    }));
  }, [overviewMonths, overviewMax]);

  const areaPath = useMemo(() => {
    if (chartPoints.length === 0) return "";
    const line = chartPoints.map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = chartPoints[i - 1];
      const cpx1 = prev.x + (p.x - prev.x) * 0.4;
      const cpx2 = prev.x + (p.x - prev.x) * 0.6;
      return `C ${cpx1} ${prev.y}, ${cpx2} ${p.y}, ${p.x} ${p.y}`;
    }).join(" ");
    const last = chartPoints[chartPoints.length - 1];
    const first = chartPoints[0];
    return `${line} L ${last.x} 100 L ${first.x} 100 Z`;
  }, [chartPoints]);

  const linePath = useMemo(() => {
    if (chartPoints.length === 0) return "";
    return chartPoints.map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = chartPoints[i - 1];
      const cpx1 = prev.x + (p.x - prev.x) * 0.4;
      const cpx2 = prev.x + (p.x - prev.x) * 0.6;
      return `C ${cpx1} ${prev.y}, ${cpx2} ${p.y}, ${p.x} ${p.y}`;
    }).join(" ");
  }, [chartPoints]);

  return (
    <PageCard
      label="Billing"
      title="Payments"
      headerAction={
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <button
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "table"
                ? "bg-white text-purple-700 shadow-sm"
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
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <BarChart3Icon className="size-3.5" />
            Monthly
          </button>
        </div>
      }
    >

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
          {/* KPI summary row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">Gross Revenue</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
                  <DollarSign className="size-4 text-purple-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                ${currentMonthTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {revenueChange !== null && (
                <div className="flex items-center gap-1 mt-1">
                  {revenueChange >= 0 ? (
                    <TrendingUpIcon className="size-3.5 text-emerald-500" />
                  ) : (
                    <TrendingDownIcon className="size-3.5 text-red-500" />
                  )}
                  <span className={`text-xs font-medium ${revenueChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {revenueChange >= 0 ? "+" : ""}{revenueChange}%
                  </span>
                  <span className="text-xs text-gray-400">vs last month</span>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">Transactions</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                  <ReceiptTextIcon className="size-4 text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{currentMonthCount}</p>
              <p className="text-xs text-gray-400 mt-1">
                {prevMonthData ? `${prevMonthData.count} last month` : "No prior data"}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">Avg per Transaction</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                  <ArrowRightIcon className="size-4 text-amber-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                ${currentMonthAvg.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {prevMonthData && prevMonthData.avgPerTransaction > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  ${prevMonthData.avgPerTransaction.toFixed(2)} last month
                </p>
              )}
            </div>
          </div>

          {/* Revenue trend — area chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue Trend — Last 12 Months</h3>
            <div className="relative h-48">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="w-full h-full"
              >
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(147, 51, 234)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="rgb(147, 51, 234)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {/* Grid lines */}
                {[0, 25, 50, 75].map((y) => (
                  <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#f3f4f6" strokeWidth="0.3" />
                ))}
                {/* Area fill */}
                <path d={areaPath} fill="url(#areaGrad)" />
                {/* Line */}
                <path d={linePath} fill="none" stroke="rgb(147, 51, 234)" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" />
                {/* Dots */}
                {chartPoints.map((p) => (
                  <circle
                    key={p.key}
                    cx={p.x}
                    cy={p.y}
                    r={p.isCurrent ? "1.2" : "0.7"}
                    fill={p.isCurrent ? "rgb(147, 51, 234)" : "white"}
                    stroke="rgb(147, 51, 234)"
                    strokeWidth="0.4"
                  />
                ))}
              </svg>
              {/* Hover value labels positioned above dots */}
              <div className="absolute inset-0 flex">
                {chartPoints.map((p) => (
                  <div key={p.key} className="flex-1 group relative">
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                      <div className="bg-gray-900 text-white text-[10px] font-medium px-2 py-1 rounded whitespace-nowrap">
                        {p.label}: {formatCompact(p.total)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Month labels */}
            <div className="flex mt-2">
              {overviewMonths.map((m) => (
                <div key={m.key} className="flex-1 text-center">
                  <span className={`text-[10px] ${m.isCurrent ? "font-semibold text-purple-600" : "text-gray-400"}`}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly cards with weekly breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monthlyData.map((m, mIdx) => {
                const weekMax = Math.max(...m.weeks.map((w) => w.total), 1);
                const prevMonth = monthlyData[mIdx + 1];
                const monthChange = prevMonth ? pctChange(m.total, prevMonth.total) : null;
                const isCurrent = m.key === currentMonthKey;

                return (
                  <div
                    key={m.key}
                    className={`rounded-xl border p-5 transition-all ${
                      isCurrent
                        ? "bg-purple-50/50 border-purple-200"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={`text-sm font-semibold ${isCurrent ? "text-purple-900" : "text-gray-700"}`}>
                        {m.label}
                      </h4>
                      {monthChange !== null && (
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium rounded-full px-1.5 py-0.5 ${
                          monthChange >= 0
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-red-50 text-red-600"
                        }`}>
                          {monthChange >= 0 ? (
                            <TrendingUpIcon className="size-2.5" />
                          ) : (
                            <TrendingDownIcon className="size-2.5" />
                          )}
                          {monthChange >= 0 ? "+" : ""}{monthChange}%
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-3 mb-1">
                      <span className={`text-xl font-bold ${isCurrent ? "text-purple-900" : "text-gray-900"}`}>
                        ${m.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-4">
                      <span>{m.count} payment{m.count !== 1 ? "s" : ""}</span>
                      <span className="text-gray-200">|</span>
                      <span>${m.avgPerTransaction.toFixed(0)} avg</span>
                    </div>

                    {/* Weekly bar chart */}
                    <div className="flex items-end gap-1.5 h-16">
                      {m.weeks.map((w, i) => {
                        const height = weekMax > 0 ? (w.total / weekMax) * 100 : 0;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div className="w-full relative h-12">
                              <div
                                className={`absolute bottom-0 left-0 right-0 rounded transition-all ${
                                  w.total > 0
                                    ? isCurrent
                                      ? "bg-gradient-to-t from-purple-600 to-purple-400"
                                      : "bg-gradient-to-t from-gray-300 to-gray-200"
                                    : "bg-gray-100"
                                }`}
                                style={{ height: `${Math.max(height, 6)}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-gray-400 font-medium">W{i + 1}</span>
                            {/* Tooltip */}
                            {w.total > 0 && (
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                                <div className="bg-gray-900 text-white text-[9px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap">
                                  ${w.total.toFixed(0)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {monthlyData.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
              <BarChart3Icon className="size-8 mx-auto mb-2 text-gray-300" />
              No payment data to display.
            </div>
          )}
        </div>
      )}
    </PageCard>
  );
}
