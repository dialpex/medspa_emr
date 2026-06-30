"use client";

import { useState, useEffect, useTransition, useCallback, useMemo, useRef } from "react";
import { X, Plus, Trash2, Eye, Search, CreditCard, Loader2, RotateCcw } from "lucide-react";
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
  type ClinicInfo,
} from "@/lib/actions/invoices";
import { payWithWallet, getWalletBalanceAction } from "@/lib/actions/wallet";
import { InvoicePreview } from "./invoice-preview";
import { StripeProvider } from "@/components/stripe/stripe-provider";
import { CheckoutForm } from "@/components/stripe/checkout-form";

function StripeInlineCheckout({ clientSecret, stripeAccountId, onSuccess, onError }: { clientSecret: string; stripeAccountId: string; onSuccess: () => void; onError: (msg: string) => void }) {
  return (
    <StripeProvider clientSecret={clientSecret} stripeAccountId={stripeAccountId}>
      <CheckoutForm onSuccess={onSuccess} onError={onError} />
    </StripeProvider>
  );
}

type ServiceOption = { id: string; name: string; price: number };
type ProductOption = { id: string; name: string; price: number };

type SavedCard = {
  id: string;
  stripePaymentMethodId: string;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  isDefault: boolean;
};

type Props = {
  invoice: InvoiceDetail | null;
  services: ServiceOption[];
  products: ProductOption[];
  clinicInfo: ClinicInfo;
  onClose: () => void;
  stripeConnected?: boolean;
  stripeAccountId?: string | null;
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Draft: { bg: "bg-gray-100", text: "text-gray-700" },
  Sent: { bg: "bg-blue-100", text: "text-blue-700" },
  PartiallyPaid: { bg: "bg-yellow-100", text: "text-yellow-700" },
  Paid: { bg: "bg-green-100", text: "text-green-700" },
  Overdue: { bg: "bg-red-100", text: "text-red-700" },
  Void: { bg: "bg-gray-100", text: "text-gray-400 line-through" },
  Refunded: { bg: "bg-red-100", text: "text-red-700" },
};

const PAYMENT_METHODS_BASE = ["Cash", "Credit Card", "Debit Card", "Check", "Bank Transfer", "Wallet", "Other"];

export function InvoiceModal({ invoice, services, products, clinicInfo, onClose, stripeConnected, stripeAccountId }: Props) {
  const PAYMENT_METHODS = stripeConnected
    ? [{ value: "Stripe", label: "Card" }, ...PAYMENT_METHODS_BASE.map((m) => ({ value: m, label: m }))]
    : PAYMENT_METHODS_BASE.map((m) => ({ value: m, label: m }));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

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
      productId: i.productId || undefined,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })) ?? []
  );

  // Due date (default 30 days from now for new invoices)
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 30);
  const [dueDate, setDueDate] = useState(
    invoice?.dueDate
      ? new Date(invoice.dueDate).toISOString().slice(0, 10)
      : defaultDueDate.toISOString().slice(0, 10)
  );

  // Discount & Tax
  const [discountType, setDiscountType] = useState<"$" | "%">(invoice?.discountPercent != null ? "%" : "$");
  const [discountValue, setDiscountValue] = useState(
    invoice?.discountPercent != null ? invoice.discountPercent : invoice?.discountAmount ?? 0
  );
  const clinicTaxRate = clinicInfo.defaultTaxRate ?? 0;
  const [taxEnabled, setTaxEnabled] = useState((invoice?.taxRate ?? clinicTaxRate) > 0);
  const [taxRate, setTaxRate] = useState(invoice?.taxRate ?? clinicTaxRate);

  // Payment recording
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<string>(stripeConnected ? "Stripe" : "Cash");
  const [payReference, setPayReference] = useState("");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Stripe payment
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | "new">("new");
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [refundingPaymentId, setRefundingPaymentId] = useState<string | null>(null);

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

  // Close item dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (itemSearchRef.current && !itemSearchRef.current.parentElement?.parentElement?.contains(e.target as Node)) {
        setShowItemDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch saved cards when Stripe is selected and patient is set
  useEffect(() => {
    if (payMethod === "Stripe" && invoice?.patientId && stripeConnected) {
      fetch(`/api/billing/stripe/payment-methods?patientId=${invoice.patientId}`)
        .then((res) => res.ok ? res.json() : [])
        .then((data) => {
          setSavedCards(data);
          if (data.length > 0) setSelectedCardId(data[0].id);
          else setSelectedCardId("new");
        })
        .catch(() => setSavedCards([]));
    }
  }, [payMethod, invoice?.patientId, stripeConnected]);

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

  // Item search (services + products)
  const [itemSearch, setItemSearch] = useState("");
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const itemSearchRef = useRef<HTMLInputElement>(null);

  const catalogItems = useMemo(() => {
    const all: { id: string; type: "service" | "product"; name: string; price: number }[] = [
      ...services.map((s) => ({ id: s.id, type: "service" as const, name: s.name, price: s.price })),
      ...products.map((p) => ({ id: p.id, type: "product" as const, name: p.name, price: p.price })),
    ];
    if (!itemSearch.trim()) return all;
    const q = itemSearch.toLowerCase();
    return all.filter((i) => i.name.toLowerCase().includes(q));
  }, [services, products, itemSearch]);

  function addCatalogItem(item: { id: string; type: "service" | "product"; name: string; price: number }) {
    const newItem: InvoiceItemInput & { key: string } = {
      key: crypto.randomUUID(),
      description: item.name,
      quantity: 1,
      unitPrice: item.price,
    };
    if (item.type === "service") newItem.serviceId = item.id;
    else newItem.productId = item.id;
    setItems((prev) => [...prev, newItem]);
    setItemSearch("");
    setShowItemDropdown(false);
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
    if (!dueDate) { setError("Due date is required"); return; }

    const input = {
      patientId,
      items: items.map(({ key, ...rest }) => rest),
      discountAmount: discountType === "$" ? discountValue : 0,
      discountPercent: discountType === "%" ? discountValue : null,
      taxRate: taxEnabled ? taxRate : null,
      notes: invoice?.notes ?? undefined,
      dueDate,
    };

    startTransition(async () => {
      const result = invoice
        ? await updateInvoice(invoice.id, input)
        : await createInvoice(input);
      if (!result.success) { setError(result.error); return; }
      onClose();
    });
  }

  async function handleStripeNewCard() {
    if (!invoice || payAmount <= 0) return;
    setStripeLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/stripe/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id, amount: payAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment");
      setStripeClientSecret(data.clientSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize payment");
    } finally {
      setStripeLoading(false);
    }
  }

  async function handleStripeSavedCard() {
    if (!invoice || payAmount <= 0 || selectedCardId === "new") return;
    setStripeLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/stripe/charge-saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id, paymentMethodId: selectedCardId, amount: payAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to charge card");
      if (data.status === "requires_action" && data.clientSecret) {
        setStripeClientSecret(data.clientSecret);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to charge card");
    } finally {
      setStripeLoading(false);
    }
  }

  async function handleRefund(paymentId: string) {
    setRefundingPaymentId(paymentId);
    setError(null);
    try {
      const res = await fetch("/api/billing/stripe/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process refund");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process refund");
    } finally {
      setRefundingPaymentId(null);
    }
  }

  function handleRecordPayment() {
    if (payAmount <= 0 || !invoice) return;
    setError(null);

    if (payMethod === "Stripe") {
      if (selectedCardId === "new") {
        handleStripeNewCard();
      } else {
        handleStripeSavedCard();
      }
      return;
    }

    startTransition(async () => {
      if (payMethod === "Wallet") {
        const result = await payWithWallet(invoice.id, payAmount);
        if (!result.success) { setError(result.error); return; }
      } else {
        const result = await recordPayment({
          invoiceId: invoice.id,
          amount: payAmount,
          paymentMethod: payMethod,
          reference: payReference || undefined,
        });
        if (!result.success) { setError(result.error); return; }
      }
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

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
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
                          step={1}
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
            <div className="flex gap-2 mt-2 items-start">
              <div className="relative flex-1 max-w-xs">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <input
                    ref={itemSearchRef}
                    type="text"
                    value={itemSearch}
                    onChange={(e) => { setItemSearch(e.target.value); setShowItemDropdown(true); }}
                    onFocus={() => setShowItemDropdown(true)}
                    placeholder="Search services & products..."
                    className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                {showItemDropdown && (
                  <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {catalogItems.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-gray-400">No results</li>
                    ) : (
                      catalogItems.map((item) => (
                        <li key={`${item.type}-${item.id}`}>
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                            onClick={() => addCatalogItem(item)}
                          >
                            <span>
                              {item.name}
                              <span className="ml-2 text-xs text-gray-400 capitalize">{item.type}</span>
                            </span>
                            <span className="text-gray-500">${item.price.toFixed(2)}</span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
              <button onClick={addCustomItem} className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 whitespace-nowrap py-1.5">
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
                      {stripeConnected && <th className="w-20" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoice.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2">{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td className="px-3 py-2">{p.paymentMethod === "Stripe" ? "Card" : p.paymentMethod === "Stripe Refund" ? "Card Refund" : p.paymentMethod}</td>
                        <td className="px-3 py-2 text-gray-500">{p.reference || "—"}</td>
                        <td className="px-3 py-2 text-right">${p.amount.toFixed(2)}</td>
                        {stripeConnected && (
                          <td className="px-2 py-2">
                            {p.paymentMethod === "Stripe" && p.amount > 0 && (
                              <button
                                onClick={() => handleRefund(p.id)}
                                disabled={refundingPaymentId === p.id}
                                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                {refundingPaymentId === p.id ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="size-3" />
                                )}
                                Refund
                              </button>
                            )}
                          </td>
                        )}
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
                <div className="space-y-3 pt-2">
                  <div className="flex items-end gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Amount</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          max={balance}
                          value={payAmount}
                          onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                          className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setPayAmount(balance)}
                          className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 whitespace-nowrap"
                        >
                          Pay in Full
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Method</label>
                      <select value={payMethod} onChange={(e) => {
                        setPayMethod(e.target.value);
                        setStripeClientSecret(null);
                        if (e.target.value === "Wallet" && invoice?.patientId && walletBalance === null) {
                          getWalletBalanceAction(invoice.patientId).then(setWalletBalance);
                        }
                      }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                        {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      {payMethod === "Wallet" && walletBalance !== null && (
                        <div className="text-xs text-gray-500 mt-1">Balance: ${walletBalance.toFixed(2)}</div>
                      )}
                    </div>
                    {payMethod !== "Stripe" && (
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
                    )}
                    {payMethod !== "Stripe" && (
                      <button
                        onClick={handleRecordPayment}
                        disabled={isPending || payAmount <= 0}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Record Payment
                      </button>
                    )}
                  </div>

                  {/* Stripe payment flow */}
                  {payMethod === "Stripe" && !stripeClientSecret && (
                    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                      {savedCards.length > 0 && (
                        <div className="space-y-2">
                          <label className="block text-xs text-gray-500 font-medium">Select Card</label>
                          {savedCards.map((card) => (
                            <label key={card.id} className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="radio"
                                name="stripe-card"
                                value={card.id}
                                checked={selectedCardId === card.id}
                                onChange={() => setSelectedCardId(card.id)}
                                className="text-purple-600"
                              />
                              <CreditCard className="size-4 text-gray-400" />
                              <span className="text-sm">
                                {card.cardBrand || "Card"} **** {card.cardLast4}
                                {card.cardExpMonth && card.cardExpYear && (
                                  <span className="text-gray-400 ml-2">
                                    {String(card.cardExpMonth).padStart(2, "0")}/{card.cardExpYear}
                                  </span>
                                )}
                              </span>
                            </label>
                          ))}
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="stripe-card"
                              value="new"
                              checked={selectedCardId === "new"}
                              onChange={() => setSelectedCardId("new")}
                              className="text-purple-600"
                            />
                            <Plus className="size-4 text-gray-400" />
                            <span className="text-sm">New card</span>
                          </label>
                        </div>
                      )}
                      <button
                        onClick={handleRecordPayment}
                        disabled={stripeLoading || payAmount <= 0}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {stripeLoading ? (
                          <>
                            <Loader2 className="size-4 animate-spin" /> Processing...
                          </>
                        ) : selectedCardId === "new" ? (
                          "Continue to Card Entry"
                        ) : (
                          `Charge $${payAmount.toFixed(2)}`
                        )}
                      </button>
                    </div>
                  )}

                  {/* Stripe Elements inline form */}
                  {payMethod === "Stripe" && stripeClientSecret && stripeAccountId && (
                    <div className="rounded-lg border border-gray-200 p-4">
                      <StripeInlineCheckout
                        clientSecret={stripeClientSecret}
                        stripeAccountId={stripeAccountId}
                        onSuccess={onClose}
                        onError={(msg) => setError(msg)}
                      />
                    </div>
                  )}
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
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <Eye className="size-4" /> Preview
          </button>
          {!invoice && (
            <button
              onClick={() => {
                setError(null);
                if (!patientId) { setError("Please select a patient"); return; }
                if (items.length === 0) { setError("Add at least one item"); return; }
                if (items.some((i) => !i.description.trim())) { setError("All items need a description"); return; }
                if (!dueDate) { setError("Due date is required"); return; }
                const input = {
                  patientId,
                  items: items.map(({ key, ...rest }) => rest),
                  discountAmount: discountType === "$" ? discountValue : 0,
                  discountPercent: discountType === "%" ? discountValue : null,
                  taxRate: taxEnabled ? taxRate : null,
                  dueDate,
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

      {/* Invoice Preview */}
      {showPreview && (
        <InvoicePreview
          clinic={clinicInfo}
          invoiceNumber={invoice?.invoiceNumber ?? "DRAFT"}
          date={invoice ? new Date(invoice.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" }) : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" })}
          patientName={patientName}
          patientEmail={patientEmail}
          patientPhone={patientPhone}
          items={items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice }))}
          subtotal={subtotal}
          discountAmount={discountAmount}
          taxAmount={taxAmount}
          total={total}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
