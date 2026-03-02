"use client";

import { Receipt } from "lucide-react";
import type { PatientTimeline } from "@/lib/actions/patients";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-yellow-100 text-yellow-700",
  Sent: "bg-blue-100 text-blue-700",
  PartiallyPaid: "bg-yellow-100 text-yellow-700",
  Paid: "bg-green-100 text-green-700",
  Void: "bg-gray-100 text-gray-700",
  Refunded: "bg-red-100 text-red-700",
};

export function PatientInvoices({
  invoices,
}: {
  invoices: PatientTimeline["invoices"];
}) {
  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Receipt className="size-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No invoices yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {invoices.map((invoice) => (
        <div
          key={invoice.id}
          className="flex justify-between items-start p-3 bg-gray-50 rounded-lg"
        >
          <div>
            <div className="font-medium text-sm">
              {invoice.invoiceNumber} · {formatCurrency(invoice.total)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {formatDate(invoice.createdAt)}
              {invoice.paidAt && ` · Paid ${formatDate(invoice.paidAt)}`}
            </div>
          </div>
          <span
            className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[invoice.status] || "bg-gray-100 text-gray-700"}`}
          >
            {invoice.status}
          </span>
        </div>
      ))}
    </div>
  );
}
