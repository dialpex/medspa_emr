"use client";

import { useState } from "react";

type Props = {
  onFilter: (filters: { status: string; search: string; invoiceNumber: string; dateFrom: string; dateTo: string }) => void;
};

export function InvoiceFilters({ onFilter }: Props) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  function emit(overrides: Record<string, string> = {}) {
    const f = { status, search, invoiceNumber, dateFrom, dateTo, ...overrides };
    onFilter(f);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); emit({ search: e.target.value }); }}
        placeholder="Search client..."
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 w-44"
      />
      <input
        type="text"
        value={invoiceNumber}
        onChange={(e) => { setInvoiceNumber(e.target.value); emit({ invoiceNumber: e.target.value }); }}
        placeholder="Invoice #"
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 w-36"
      />
      <select
        value={status}
        onChange={(e) => { setStatus(e.target.value); emit({ status: e.target.value }); }}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">All Statuses</option>
        <option value="Draft">Draft</option>
        <option value="Sent">Sent</option>
        <option value="PartiallyPaid">Partially Paid</option>
        <option value="Paid">Paid</option>
        <option value="Void">Void</option>
        <option value="Refunded">Refunded</option>
      </select>
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => { setDateFrom(e.target.value); emit({ dateFrom: e.target.value }); }}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <span className="text-gray-400 text-sm">to</span>
      <input
        type="date"
        value={dateTo}
        onChange={(e) => { setDateTo(e.target.value); emit({ dateTo: e.target.value }); }}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
