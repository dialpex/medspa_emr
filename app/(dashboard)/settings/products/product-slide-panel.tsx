"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XIcon, Loader2Icon } from "lucide-react";
import {
  createProduct,
  updateProduct,
  type ProductItem,
} from "@/lib/actions/products";

const CATEGORIES = [
  "Skincare",
  "Hair Care",
  "Body Care",
  "Supplements",
  "Tools & Devices",
  "Other",
];

export function ProductSlidePanel({
  isOpen,
  onClose,
  product,
  defaultTaxRate,
}: {
  isOpen: boolean;
  onClose: () => void;
  product: ProductItem | null;
  defaultTaxRate: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [size, setSize] = useState("");
  const [sku, setSku] = useState("");
  const [upc, setUpc] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [wholesaleCost, setWholesaleCost] = useState("");
  const [vendor, setVendor] = useState("");
  const [inventoryCount, setInventoryCount] = useState("");
  const [taxable, setTaxable] = useState(true);

  // Reset form when product changes or panel opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (product) {
        setName(product.name);
        setDescription(product.description ?? "");
        setCategory(product.category ?? "");
        setSize(product.size ?? "");
        setSku(product.sku ?? "");
        setUpc(product.upc ?? "");
        setRetailPrice(product.retailPrice.toString());
        setWholesaleCost(product.wholesaleCost.toString());
        setVendor(product.vendor ?? "");
        setInventoryCount(product.inventoryCount.toString());
        setTaxable(product.taxable);
      } else {
        setName("");
        setDescription("");
        setCategory("");
        setSize("");
        setSku("");
        setUpc("");
        setRetailPrice("");
        setWholesaleCost("");
        setVendor("");
        setInventoryCount("0");
        setTaxable(true);
      }
    }
  }, [isOpen, product]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Product name is required");
      return;
    }

    const retail = parseFloat(retailPrice) || 0;
    const wholesale = parseFloat(wholesaleCost) || 0;
    const inventory = parseInt(inventoryCount) || 0;

    if (retail < 0 || wholesale < 0) {
      setError("Prices cannot be negative");
      return;
    }

    const input = {
      name,
      description: description || undefined,
      size: size || undefined,
      sku: sku || undefined,
      upc: upc || undefined,
      category: category || undefined,
      retailPrice: retail,
      wholesaleCost: wholesale,
      vendor: vendor || undefined,
      inventoryCount: inventory,
      taxable,
    };

    startTransition(async () => {
      try {
        if (product) {
          await updateProduct(product.id, input);
        } else {
          await createProduct(input);
        }
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  const isEditing = !!product;

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1";

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide panel from left */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[480px] max-w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? "Edit Product" : "New Product"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <XIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Scrollable body */}
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
                  placeholder="Product name"
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Size</label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 1.7 oz"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Vendor</label>
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className={inputClass}
                  placeholder="Supplier or brand name"
                />
              </div>
            </section>

            {/* Pricing */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Pricing
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Retail Price ($) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(e.target.value)}
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelClass}>Wholesale Cost ($)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={wholesaleCost}
                    onChange={(e) => setWholesaleCost(e.target.value)}
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {retailPrice && wholesaleCost && parseFloat(retailPrice) > 0 && parseFloat(wholesaleCost) > 0 && (
                <div className="text-xs text-gray-500">
                  Margin: ${(parseFloat(retailPrice) - parseFloat(wholesaleCost)).toFixed(2)}{" "}
                  ({(((parseFloat(retailPrice) - parseFloat(wholesaleCost)) / parseFloat(retailPrice)) * 100).toFixed(0)}%)
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={taxable}
                  onChange={(e) => setTaxable(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">
                  Taxable
                  {defaultTaxRate != null && (
                    <span className="text-gray-400 ml-1">({defaultTaxRate}% clinic rate)</span>
                  )}
                </span>
              </label>
            </section>

            {/* Identifiers */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Identifiers
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>SKU</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className={inputClass}
                    placeholder="Stock keeping unit"
                  />
                </div>
                <div>
                  <label className={labelClass}>UPC (Barcode)</label>
                  <input
                    type="text"
                    value={upc}
                    onChange={(e) => setUpc(e.target.value)}
                    className={inputClass}
                    placeholder="Barcode number"
                  />
                </div>
              </div>
            </section>

            {/* Inventory */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Inventory
              </h3>

              <div>
                <label className={labelClass}>Stock Count</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={inventoryCount}
                  onChange={(e) => setInventoryCount(e.target.value)}
                  className={`${inputClass} max-w-[10rem]`}
                  placeholder="0"
                />
              </div>
            </section>
          </div>

          {/* Footer actions */}
          <div className="border-t border-gray-200 px-6 py-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
              {isPending ? "Saving..." : isEditing ? "Update Product" : "Create Product"}
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
