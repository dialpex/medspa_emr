"use client";

import { DollarSign } from "lucide-react";
import type { PaymentListItem } from "@/lib/actions/payments";

type Props = { payments: PaymentListItem[] };

export function PaymentsView({ payments }: Props) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Payments</h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {payments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <DollarSign className="size-8 mx-auto mb-2 text-gray-300" />
            No payments recorded yet.
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
    </div>
  );
}
