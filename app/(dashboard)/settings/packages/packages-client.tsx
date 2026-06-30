"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { type PackageWithItems } from "@/lib/services/packages";
import { type ServiceItem } from "@/lib/actions/services";
import { ToggleActiveButton } from "./toggle-active-button";
import { PackageSlidePanel } from "./package-slide-panel";
import { PageCard } from "@/components/ui/page-card";

export function PackagesClient({
  packages,
  services,
}: {
  packages: PackageWithItems[];
  services: ServiceItem[];
}) {
  const [selectedPackage, setSelectedPackage] = useState<PackageWithItems | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  function openNew() {
    setSelectedPackage(null);
    setPanelOpen(true);
  }

  function openEdit(pkg: PackageWithItems) {
    setSelectedPackage(pkg);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setTimeout(() => setSelectedPackage(null), 300);
  }

  function formatValidity(days: number | null) {
    if (!days) return "Never";
    if (days % 365 === 0) return `${days / 365} year${days / 365 > 1 ? "s" : ""}`;
    if (days % 30 === 0) return `${days / 30} month${days / 30 > 1 ? "s" : ""}`;
    return `${days} day${days > 1 ? "s" : ""}`;
  }

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        <PageCard
          title="Packages"
          headerAction={
            <button
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Add Package
            </button>
          }
        >
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Retail Value</th>
                  <th className="px-4 py-3 font-medium">Package Price</th>
                  <th className="px-4 py-3 font-medium">Validity</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {packages.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No packages yet. Create your first package to get started.
                    </td>
                  </tr>
                )}
                {packages.map((pkg) => {
                  const savings = pkg.retailValue - pkg.packagePrice;
                  const savingsPct = pkg.retailValue > 0 ? Math.round((savings / pkg.retailValue) * 100) : 0;
                  return (
                    <tr key={pkg.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openEdit(pkg)}
                          className="font-medium text-gray-900 hover:text-purple-600 text-left"
                        >
                          {pkg.name}
                        </button>
                        {pkg.description && (
                          <div className="text-xs text-gray-400 mt-0.5">{pkg.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {pkg.items.length} service{pkg.items.length !== 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-3 text-gray-600">${pkg.retailValue.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">${pkg.packagePrice.toFixed(2)}</span>
                        {savings > 0 && (
                          <span className="ml-1.5 text-xs text-green-600">
                            Save {savingsPct}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatValidity(pkg.validityDays)}</td>
                      <td className="px-4 py-3">
                        <ToggleActiveButton packageId={pkg.id} isActive={pkg.isActive} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PageCard>
      </div>

      <PackageSlidePanel
        isOpen={panelOpen}
        onClose={closePanel}
        pkg={selectedPackage}
        services={services}
      />
    </>
  );
}
