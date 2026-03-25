"use client";

import { useState, useTransition, useMemo } from "react";
import { DollarSign, CalendarIcon } from "lucide-react";
import { PageCard } from "@/components/ui/page-card";
import { PatientAvatar } from "@/components/patient-avatar";
import { getPayments, type PaymentListItem } from "@/lib/actions/payments";

type Props = { payments: PaymentListItem[] };

export function PaymentsView({ payments: initialPayments }: Props) {
  const [payments, setPayments] = useState(initialPayments);
  const [isPending, startTransition] = useTransition();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [method, setMethod] = useState("");

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

  const methods = useMemo(() => {
    const set = new Set<string>();
    for (const p of initialPayments) set.add(p.paymentMethod);
    return Array.from(set).sort();
  }, [initialPayments]);

  return (
    <PageCard title="Payments">
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

      {/* Transaction Table */}
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Method</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reference</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">
                    <div className="flex items-center gap-3">
                      <PatientAvatar firstName={p.invoice.patient.firstName} lastName={p.invoice.patient.lastName} />
                      {p.invoice.patient.firstName} {p.invoice.patient.lastName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.invoice.invoiceNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{p.paymentMethod}</td>
                  <td className="px-4 py-3 text-gray-500">{p.reference || "\u2014"}</td>
                  <td className="px-4 py-3 text-right font-medium">${p.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageCard>
  );
}
