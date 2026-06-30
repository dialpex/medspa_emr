"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XIcon, Loader2Icon, PlusIcon, TrashIcon } from "lucide-react";
import {
  createPackageAction,
  updatePackageAction,
} from "@/lib/actions/packages";
import { type PackageWithItems } from "@/lib/services/packages";
import { type ServiceItem } from "@/lib/actions/services";

type ItemRow = {
  serviceId: string;
  quantity: string;
};

export function PackageSlidePanel({
  isOpen,
  onClose,
  pkg,
  services,
}: {
  isOpen: boolean;
  onClose: () => void;
  pkg: PackageWithItems | null;
  services: ServiceItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [packagePrice, setPackagePrice] = useState("");
  const [validityValue, setValidityValue] = useState("");
  const [validityUnit, setValidityUnit] = useState<"days" | "months" | "years">("months");
  const [items, setItems] = useState<ItemRow[]>([{ serviceId: "", quantity: "1" }]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (pkg) {
        setName(pkg.name);
        setDescription(pkg.description ?? "");
        setPackagePrice(pkg.packagePrice.toString());
        setItems(
          pkg.items.map((i) => ({ serviceId: i.serviceId, quantity: i.quantity.toString() }))
        );
        if (pkg.validityDays) {
          if (pkg.validityDays % 365 === 0) {
            setValidityValue((pkg.validityDays / 365).toString());
            setValidityUnit("years");
          } else if (pkg.validityDays % 30 === 0) {
            setValidityValue((pkg.validityDays / 30).toString());
            setValidityUnit("months");
          } else {
            setValidityValue(pkg.validityDays.toString());
            setValidityUnit("days");
          }
        } else {
          setValidityValue("");
          setValidityUnit("months");
        }
      } else {
        setName("");
        setDescription("");
        setPackagePrice("");
        setValidityValue("");
        setValidityUnit("months");
        setItems([{ serviceId: "", quantity: "1" }]);
      }
    }
  }, [isOpen, pkg]);

  function addItem() {
    setItems([...items, { serviceId: "", quantity: "1" }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof ItemRow, value: string | number) {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  // Compute retail value live
  const retailValue = items.reduce((sum, item) => {
    const svc = services.find((s) => s.id === item.serviceId);
    const qty = parseInt(item.quantity) || 0;
    return sum + (svc ? svc.price * qty : 0);
  }, 0);

  const price = parseFloat(packagePrice) || 0;
  const savings = retailValue - price;
  const savingsPct = retailValue > 0 ? Math.round((savings / retailValue) * 100) : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Package name is required");
      return;
    }

    const validItems = items
      .filter((i) => i.serviceId && (parseInt(i.quantity) || 0) > 0)
      .map((i) => ({ serviceId: i.serviceId, quantity: parseInt(i.quantity) }));
    if (validItems.length === 0) {
      setError("Add at least one service");
      return;
    }

    // Check for duplicate services
    const serviceIds = validItems.map((i) => i.serviceId);
    if (new Set(serviceIds).size !== serviceIds.length) {
      setError("Each service can only appear once");
      return;
    }

    if (price < 0) {
      setError("Price cannot be negative");
      return;
    }

    let validityDays: number | null = null;
    if (validityValue) {
      const v = parseInt(validityValue);
      if (v > 0) {
        if (validityUnit === "years") validityDays = v * 365;
        else if (validityUnit === "months") validityDays = v * 30;
        else validityDays = v;
      }
    }

    const input = {
      name: trimmedName,
      description: description.trim() || undefined,
      packagePrice: price,
      validityDays,
      items: validItems,
    };

    startTransition(async () => {
      try {
        const result = pkg
          ? await updatePackageAction(pkg.id, input)
          : await createPackageAction(input);
        if (!result.success) {
          setError(result.error);
          return;
        }
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  const isEditing = !!pkg;
  const activeServices = services.filter((s) => s.isActive);

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1";

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 right-0 z-50 h-full w-[520px] max-w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? "Edit Package" : "New Package"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <XIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Basic Info */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Basic Info
              </h3>
              <div>
                <label className={labelClass}>Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Winter Makeover"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className={inputClass}
                  placeholder="Optional description"
                />
              </div>
            </section>

            {/* Package Items */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Included Services
              </h3>

              <div className="space-y-3">
                {items.map((item, idx) => {
                  const svc = services.find((s) => s.id === item.serviceId);
                  const qty = parseInt(item.quantity) || 0;
                  const subtotal = svc ? svc.price * qty : 0;
                  return (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="flex-1">
                        <select
                          value={item.serviceId}
                          onChange={(e) => updateItem(idx, "serviceId", e.target.value)}
                          className={inputClass}
                        >
                          <option value="">Select service...</option>
                          {activeServices.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} — ${s.price.toFixed(2)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-20">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                          className={inputClass}
                          placeholder="Qty"
                        />
                      </div>
                      <div className="w-24 pt-2 text-right text-sm text-gray-500">
                        {subtotal > 0 && `$${subtotal.toFixed(2)}`}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        disabled={items.length <= 1}
                        className="mt-2 p-1 text-gray-400 hover:text-red-500 disabled:opacity-30"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Add Service
              </button>
            </section>

            {/* Pricing */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Pricing
              </h3>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Retail Value</span>
                  <span className="font-medium text-gray-700">${retailValue.toFixed(2)}</span>
                </div>
                <div>
                  <label className={labelClass}>Package Price *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={packagePrice}
                    onChange={(e) => setPackagePrice(e.target.value)}
                    className={inputClass}
                    placeholder="0.00"
                    required
                  />
                </div>
                {savings > 0 && price > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Patient Savings</span>
                    <span className="font-medium text-green-600">
                      Save ${savings.toFixed(2)} ({savingsPct}% off)
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Validity */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Validity
              </h3>
              <p className="text-xs text-gray-500">
                How long after purchase the patient can use this package. Leave empty for no expiration.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={validityValue}
                  onChange={(e) => setValidityValue(e.target.value)}
                  className={`${inputClass} w-24`}
                  placeholder="—"
                />
                <select
                  value={validityUnit}
                  onChange={(e) => setValidityUnit(e.target.value as "days" | "months" | "years")}
                  className={inputClass}
                  style={{ width: "120px" }}
                >
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </section>
          </div>

          <div className="border-t border-gray-200 px-6 py-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
              {isPending ? "Saving..." : isEditing ? "Update Package" : "Create Package"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
