"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { type ProductItem } from "@/lib/actions/products";
import { ToggleActiveButton } from "./toggle-active-button";
import { ProductSlidePanel } from "./product-slide-panel";
import { PageCard } from "@/components/ui/page-card";

export function ProductsClient({
  products,
  defaultTaxRate,
}: {
  products: ProductItem[];
  defaultTaxRate: number | null;
}) {
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  function openNew() {
    setSelectedProduct(null);
    setPanelOpen(true);
  }

  function openEdit(product: ProductItem) {
    setSelectedProduct(product);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    // Clear selection after animation completes
    setTimeout(() => setSelectedProduct(null), 300);
  }

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        <PageCard
          title="Products"
          headerAction={
            <button
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Add Product
            </button>
          }
        >
          <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Retail Price</th>
                <th className="px-4 py-3 font-medium">Inventory</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No products yet. Add your first product to get started.
                  </td>
                </tr>
              )}
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(p)}
                      className="font-medium text-gray-900 hover:text-purple-600 text-left"
                    >
                      {p.name}
                    </button>
                    {p.size && (
                      <span className="ml-1.5 text-gray-400 text-xs">{p.size}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.category || "\u2014"}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.sku || "\u2014"}</td>
                  <td className="px-4 py-3 text-gray-600">${p.retailPrice.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${p.inventoryCount <= 0 ? "text-red-600" : p.inventoryCount <= 5 ? "text-orange-600" : "text-gray-900"}`}>
                      {p.inventoryCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ToggleActiveButton productId={p.id} isActive={p.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </PageCard>
      </div>

      <ProductSlidePanel
        isOpen={panelOpen}
        onClose={closePanel}
        product={selectedProduct}
        defaultTaxRate={defaultTaxRate}
      />
    </>
  );
}
