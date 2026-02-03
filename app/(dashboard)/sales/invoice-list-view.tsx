"use client";

import { useState, useTransition } from "react";
import { Plus, MoreVertical, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { InvoiceFilters } from "./invoice-filters";
import { InvoiceModal } from "./invoice-modal";
import {
  getInvoices,
  getInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  type InvoiceListItem,
  type InvoiceDetail,
  type ClinicInfo,
} from "@/lib/actions/invoices";

type ServiceOption = { id: string; name: string; price: number };

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Draft: { bg: "bg-gray-100", text: "text-gray-700" },
  Sent: { bg: "bg-blue-100", text: "text-blue-700" },
  PartiallyPaid: { bg: "bg-yellow-100", text: "text-yellow-700" },
  Paid: { bg: "bg-green-100", text: "text-green-700" },
  Void: { bg: "bg-gray-100", text: "text-gray-400 line-through" },
  Refunded: { bg: "bg-red-100", text: "text-red-700" },
};

type Props = {
  initialInvoices: InvoiceListItem[];
  services: ServiceOption[];
  clinicInfo: ClinicInfo;
};

export function InvoiceListView({ initialInvoices, services, clinicInfo }: Props) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [modalInvoice, setModalInvoice] = useState<InvoiceDetail | null | "new">(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFilter(filters: { status: string; search: string; invoiceNumber: string; dateFrom: string; dateTo: string }) {
    startTransition(async () => {
      const result = await getInvoices({
        status: filters.status || undefined,
        search: filters.search || undefined,
        invoiceNumber: filters.invoiceNumber || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      setInvoices(result);
    });
  }

  function openInvoice(id: string) {
    startTransition(async () => {
      const inv = await getInvoice(id);
      if (inv) setModalInvoice(inv);
    });
  }

  function handleCloseModal() {
    setModalInvoice(null);
    // Refresh list
    startTransition(async () => {
      const result = await getInvoices();
      setInvoices(result);
    });
  }

  function handleStatusChange(id: string, status: string) {
    setMenuOpen(null);
    startTransition(async () => {
      await updateInvoiceStatus(id, status);
      const result = await getInvoices();
      setInvoices(result);
    });
  }

  function handleDelete(id: string) {
    setMenuOpen(null);
    setConfirmDeleteId(id);
  }

  function confirmDelete() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    startTransition(async () => {
      await deleteInvoice(id);
      const result = await getInvoices();
      setInvoices(result);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Invoices</h2>
        <button
          onClick={() => setModalInvoice("new")}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
        >
          <Plus className="size-4" /> New Invoice
        </button>
      </div>

      <InvoiceFilters onFilter={handleFilter} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="size-8 mx-auto mb-2 text-gray-300" />
            No invoices found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openInvoice(inv.id)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-900">{inv.patient.firstName} {inv.patient.lastName}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", STATUS_COLORS[inv.status]?.bg, STATUS_COLORS[inv.status]?.text)}>
                      {inv.status === "PartiallyPaid" ? "Partially Paid" : inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">${inv.total.toFixed(2)}</td>
                  <td className="px-4 py-2 relative" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setMenuOpen(menuOpen === inv.id ? null : inv.id)} className="text-gray-400 hover:text-gray-600 p-1">
                      <MoreVertical className="size-4" />
                    </button>
                    {menuOpen === inv.id && (
                      <div className="fixed z-50 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1" style={{ marginTop: 4 }} ref={(el) => {
                        if (el) {
                          const btn = el.parentElement?.querySelector("button");
                          if (btn) {
                            const rect = btn.getBoundingClientRect();
                            el.style.top = `${rect.bottom + 4}px`;
                            el.style.left = `${rect.right - el.offsetWidth}px`;
                          }
                        }
                      }}>
                        {inv.status === "Draft" && (
                          <button onClick={() => handleStatusChange(inv.id, "Sent")} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Send Now</button>
                        )}
                        {inv.status !== "Void" && inv.status !== "Refunded" && (
                          <button onClick={() => handleStatusChange(inv.id, "Void")} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600">Void</button>
                        )}
                        <button onClick={() => handleDelete(inv.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600">Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalInvoice !== null && (
        <InvoiceModal
          invoice={modalInvoice === "new" ? null : modalInvoice}
          services={services}
          clinicInfo={clinicInfo}
          onClose={handleCloseModal}
        />
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Invoice</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this invoice? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={isPending} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
