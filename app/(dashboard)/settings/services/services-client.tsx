"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { type ServiceItem, type TemplateOption } from "@/lib/actions/services";
import { ToggleActiveButton } from "./toggle-active-button";
import { ServiceSlidePanel } from "./service-slide-panel";
import { PageCard } from "@/components/ui/page-card";

export function ServicesClient({
  services,
  templates,
}: {
  services: ServiceItem[];
  templates: TemplateOption[];
}) {
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  function openNew() {
    setSelectedService(null);
    setPanelOpen(true);
  }

  function openEdit(service: ServiceItem) {
    setSelectedService(service);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setTimeout(() => setSelectedService(null), 300);
  }

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        <PageCard
          label="Configuration"
          title="Services"
          headerAction={
            <button
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Add Service
            </button>
          }
        >
          <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No services yet. Add your first service to get started.
                  </td>
                </tr>
              )}
              {services.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(s)}
                      className="font-medium text-gray-900 hover:text-purple-600 text-left"
                    >
                      {s.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.category || "\u2014"}</td>
                  <td className="px-4 py-3 text-gray-600">{s.duration} min</td>
                  <td className="px-4 py-3 text-gray-600">${s.price.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <ToggleActiveButton serviceId={s.id} isActive={s.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </PageCard>
      </div>

      <ServiceSlidePanel
        isOpen={panelOpen}
        onClose={closePanel}
        service={selectedService}
        templates={templates}
      />
    </>
  );
}
