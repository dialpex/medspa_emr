"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createInvoice,
  updateInvoice,
  recordPayment,
  searchPatients,
  quickCreatePatient,
  type InvoiceDetail,
  type InvoiceItemInput,
  type PaymentInput,
} from "@/lib/actions/invoices";

type ServiceOption = { id: string; name: string; price: number };

type Props = {
  invoice: InvoiceDetail | null;
  services: ServiceOption[];
  onClose: () => void;
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Draft: { bg: "bg-gray-100", text: "text-gray-700" },
  Sent: { bg: "bg-blue-100", text: "text-blue-700" },
  PartiallyPaid: { bg: "bg-yellow-100", text: "text-yellow-700" },
  Paid: { bg: "bg-green-100", text: "text-green-700" },
  Void: { bg: "bg-gray-100", text: "text-gray-400 line-through" },
  Refunded: { bg: "bg-red-100", text: "text-red-700" },
};

const PAYMENT_METHODS = ["Cash", "Credit Card", "Debit Card", "Check", "Bank Transfer", "Other"];

export function InvoiceModal({ invoice, services, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Patient
  const [patientId, setPatientId] = useState(invoice?.patientId ?? "");
  const [patientName, setPatientName] = useState(
    invoice ? `${invoice.patient.firstName} ${invoice.patient.lastName}` : ""
  );
  const [patientSearch, setPatientSearch] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientTags, setPatientTags] = useState("");
  const [patientResults, setPatientResults] = useState<{ id: string; firstName: string; lastName: string; email: string | null; phone: string | null; tags: string | null }[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Items
  const [items, setItems] = useState<(InvoiceItemInput & { key: string })[]>(
    invoice?.items.map((i) => ({
      key: crypto.randomUUID(),
      serviceId: i.serviceId || undefined,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })) ?? []
  );

  // Discount & Tax
  const [discountType, setDiscountType] = useState<"$" | "%">(invoice?.discountPercent != null ? "%" : "$");
  const [discountValue, setDiscountValue] = useState(
    invoice?.discountPercent != null ? invoice.discountPercent : invoice?.discountAmount ?? 0
  );
  const [taxEnabled, setTaxEnabled] = useState((invoice?.taxRate ?? 0) > 0);
  const [taxRate, setTaxRate] = useState(invoice?.taxRate ?? 0);

  // Payment recording
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("Cash");
  const [payReference, setPayReference] = useState("");

  // Status
  const status = invoice?.status ?? "Draft";

  // Calculations
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discountAmount = discountType === "%" ? subtotal * (discountValue / 100) : discountValue;
  const afterDiscount = Math.max(subtotal - discountAmount, 0);
  const taxAmount = taxEnabled && taxRate > 0 ? afterDiscount * (taxRate / 100) : 0;
  const total = Math.round((afterDiscount + taxAmount) * 100) / 100;
  const totalPaid = invoice?.payments.reduce((s, p) => s + p.amount, 0) ?? 0;
  const balance = Math.round((total - totalPaid) * 100) / 100;

  // Patient search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setPatientResults([]); return; }
    const results = await searchPatients(q);
    setPatientResults(results);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(patientSearch), 300);
    return () => clearTimeout(timer);
  }, [patientSearch, doSearch]);

  function addServiceItem(serviceId: string) {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    setItems((prev) => [...prev, { key: crypto.randomUUID(), serviceId, description: svc.name, quantity: 1, unitPrice: svc.price }]);
  }

  function addCustomItem() {
    setItems((prev) => [...prev, { key: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 }]);
  }

  function updateItem(key: string, field: string, value: string | number) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, [field]: value } : i)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function handleSave() {
    setError(null);
    if (!patientId) { setError("Please select a patient"); return; }
    if (items.length === 0) { setError("Add at least one item"); return; }
    if (items.some((i) => !i.description.trim())) { setError("All items need a description"); return; }

    const input = {
      patientId,
      items: items.map(({ key, ...rest }) => rest),
      discountAmount: discountType === "$" ? discountValue : 0,
      discountPercent: discountType === "%" ? discountValue : null,
      taxRate: taxEnabled ? taxRate : null,
      notes: invoice?.notes ?? undefined,
    };

    startTransition(async () => {
      const result = invoice
        ? await updateInvoice(invoice.id, input)
        : await createInvoice(input);
      if (!result.success) { setError(result.error); return; }
      onClose();
    });
  }

  function handleRecordPayment() {
    if (payAmount <= 0 || !invoice) return;
    setError(null);
    startTransition(async () => {
      const result = await recordPayment({
        invoiceId: invoice.id,
        amount: payAmount,
        paymentMethod: payMethod,
        reference: payReference || undefined,
      });
      if (!result.success) { setError(result.error); return; }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{invoice ? `Invoice ${invoice.invoiceNumber}` : "New Invoice"}</h2>
            {invoice && (
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[status]?.bg, STATUS_COLORS[status]?.text)}>
                {status === "PartiallyPaid" ? "Partially Paid" : status}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="size-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {/* Patient Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
            {patientId ? (
              <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                <div className="text-sm">
                  <span className="font-medium text-gray-900">{patientName}</span>
                </div>
                <div className="text-sm text-gray-500">{patientEmail || "—"}</div>
                <div className="text-sm text-gray-500">{patientPhone || "—"}</div>
                <div className="text-sm text-gray-400">{patientTags || "—"}</div>
                <button onClick={() => { setPatientId(""); setPatientName(""); setPatientEmail(""); setPatientPhone(""); setPatientTags(""); }} className="text-xs text-purple-600 hover:underline">Change</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => { setPatientSearch(e.target.value); setShowPatientDropdown(true); }}
                  onFocus={() => setShowPatientDropdown(true)}
                  placeholder="Search patient by name..."
                  className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
                {showPatientDropdown && patientSearch.length >= 2 && (
                  <ul className="absolute z-10 mt-1 w-full max-w-xs bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {patientResults.map((p) => (
                      <li key={p.id}>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            setPatientId(p.id);
                            setPatientName(`${p.firstName} ${p.lastName}`);
                            setPatientEmail(p.email || "");
                            setPatientPhone(p.phone || "");
                            setPatientTags(p.tags || "");
                            setPatientSearch("");
                            setShowPatientDropdown(false);
                          }}
                        >
                          {p.firstName} {p.lastName}
                        </button>
                      </li>
                    ))}
                    <li className="border-t">
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50"
                        onClick={() => { setShowNewPatient(true); setShowPatientDropdown(false); }}
                      >
                        <Plus className="size-4" /> New Patient
                      </button>
                    </li>
                  </ul>
                )}
                {showNewPatient && (
                  <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <div className="text-sm font-medium text-gray-700">New Patient</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">First Name</label>
                        <input value={newFirst} onChange={(e) => setNewFirst(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Last Name</label>
                        <input value={newLast} onChange={(e) => setNewLast(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Email</label>
                        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Phone</label>
                        <input type="tel" value={newPhone} onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                          let formatted = "";
                          if (digits.length > 6) formatted = `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`;
                          else if (digits.length > 3) formatted = `(${digits.slice(0, 3)})${digits.slice(3)}`;
                          else if (digits.length > 0) formatted = `(${digits}`;
                          else formatted = "";
                          setNewPhone(formatted);
                        }} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={isPending || !newFirst.trim() || !newLast.trim()}
                        onClick={() => {
                          startTransition(async () => {
                            const p = await quickCreatePatient({ firstName: newFirst.trim(), lastName: newLast.trim(), email: newEmail.trim() || undefined, phone: newPhone.trim() || undefined });
                            setPatientId(p.id);
                            setPatientName(`${p.firstName} ${p.lastName}`);
                            setPatientEmail(p.email || "");
                            setPatientPhone(p.phone || "");
                            setPatientTags("");
                            setShowNewPatient(false);
                            setPatientSearch("");
                            setNewFirst(""); setNewLast(""); setNewEmail(""); setNewPhone("");
                          });
                        }}
                        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        {isPending ? "Creating..." : "Create Patient"}
                      </button>
                      <button onClick={() => setShowNewPatient(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Line Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Line Items</label>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Description</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500 w-20">Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500 w-28">Unit Price</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500 w-24">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => (
                    <tr key={item.key}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(item.key, "description", e.target.value)}
                          className="w-full border-0 p-0 text-sm focus:ring-0"
                          placeholder="Item description"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(item.key, "quantity", parseInt(e.target.value) || 1)}
                          className="w-full text-right border-0 p-0 text-sm focus:ring-0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.key, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="w-full text-right border-0 p-0 text-sm focus:ring-0"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">${(item.quantity * item.unitPrice).toFixed(2)}</td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeItem(item.key)} className="text-gray-400 hover:text-red-500"><Trash2 className="size-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400">No items added</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 mt-2">
              {services.length > 0 && (
                <select
                  onChange={(e) => { if (e.target.value) { addServiceItem(e.target.value); e.target.value = ""; } }}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>Add Service...</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} (${s.price.toFixed(2)})</option>
                  ))}
                </select>
              )}
              <button onClick={addCustomItem} className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700">
                <Plus className="size-4" /> Custom Item
              </button>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Discount</span>
                  <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "$" | "%")} className="border-0 text-xs text-gray-500 p-0 focus:ring-0">
                    <option value="$">$</option>
                    <option value="%">%</option>
                  </select>
                </div>
                <input
                  type="number"
                  min={0}
                  step={discountType === "%" ? 1 : 0.01}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  className="w-20 text-right border rounded px-2 py-1 text-sm"
                />
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span />
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-gray-500">
                  <input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} className="rounded" />
                  Tax
                </label>
                {taxEnabled && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-16 text-right border rounded px-2 py-1 text-sm"
                    />
                    <span className="text-gray-400">%</span>
                  </div>
                )}
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span />
                  <span>+${taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-semibold text-base">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment Section (only for existing invoices) */}
          {invoice && (
            <div className="border-t pt-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Payments</h3>
              {invoice.payments.length > 0 && (
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Date</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Method</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Reference</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoice.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2">{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td className="px-3 py-2">{p.paymentMethod}</td>
                        <td className="px-3 py-2 text-gray-500">{p.reference || "—"}</td>
                        <td className="px-3 py-2 text-right">${p.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="flex justify-between text-sm font-medium">
                <span>Balance Due</span>
                <span className={balance <= 0 ? "text-green-600" : "text-red-600"}>${balance.toFixed(2)}</span>
              </div>
              {balance > 0 && (
                <div className="flex items-end gap-3 pt-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Amount</label>
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      max={balance}
                      value={payAmount}
                      onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                      className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Method</label>
                    <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Reference</label>
                    <input
                      type="text"
                      value={payReference}
                      onChange={(e) => setPayReference(e.target.value)}
                      placeholder="Optional"
                      className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleRecordPayment}
                    disabled={isPending || payAmount <= 0}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Record Payment
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {isPending ? "Saving..." : invoice ? "Update Invoice" : "Create Invoice"}
          </button>
          {!invoice && (
            <button
              onClick={() => {
                setError(null);
                if (!patientId) { setError("Please select a patient"); return; }
                if (items.length === 0) { setError("Add at least one item"); return; }
                if (items.some((i) => !i.description.trim())) { setError("All items need a description"); return; }
                const input = {
                  patientId,
                  items: items.map(({ key, ...rest }) => rest),
                  discountAmount: discountType === "$" ? discountValue : 0,
                  discountPercent: discountType === "%" ? discountValue : null,
                  taxRate: taxEnabled ? taxRate : null,
                  status: "Sent" as const,
                };
                startTransition(async () => {
                  const result = await createInvoice(input);
                  if (!result.success) { setError(result.error); return; }
                  onClose();
                });
              }}
              disabled={isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Send Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
