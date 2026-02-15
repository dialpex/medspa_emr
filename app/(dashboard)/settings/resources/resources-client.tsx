"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import {
  type SettingsItem,
  toggleRoomActive,
  toggleResourceActive,
} from "@/lib/actions/resources";
import { ResourceSlidePanel } from "./resource-slide-panel";
import { PageCard } from "@/components/ui/page-card";

export function ResourcesClient({ items }: { items: SettingsItem[] }) {
  const [selectedItem, setSelectedItem] = useState<SettingsItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  function openNew() {
    setSelectedItem(null);
    setPanelOpen(true);
  }

  function openEdit(item: SettingsItem) {
    setSelectedItem(item);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setTimeout(() => setSelectedItem(null), 300);
  }

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        <PageCard
          title="Resources"
          headerAction={
            <button
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Add
            </button>
          }
        >
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      No rooms or resources yet. Add your first one to get started.
                    </td>
                  </tr>
                )}
                {items.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(item)}
                        className="inline-flex items-center gap-2 font-medium text-gray-900 hover:text-purple-600 text-left"
                      >
                        {item.color && (
                          <span
                            className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                        )}
                        {item.name}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={item.type} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {item.category || "\u2014"}
                    </td>
                    <td className="px-4 py-3">
                      <ToggleActiveButton item={item} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageCard>
      </div>

      <ResourceSlidePanel
        isOpen={panelOpen}
        onClose={closePanel}
        item={selectedItem}
      />
    </>
  );
}

function TypeBadge({ type }: { type: "Room" | "Resource" }) {
  const styles =
    type === "Room"
      ? "bg-blue-50 text-blue-700"
      : "bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {type}
    </span>
  );
}

function ToggleActiveButton({ item }: { item: SettingsItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      if (item.type === "Room") {
        await toggleRoomActive(item.id);
      } else {
        await toggleResourceActive(item.id);
      }
      router.refresh();
    });
  }

  return (
    <button
      disabled={isPending}
      onClick={handleToggle}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
        item.isActive
          ? "bg-green-50 text-green-700 hover:bg-green-100"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      } ${isPending ? "opacity-50" : ""}`}
    >
      {item.isActive ? "Active" : "Inactive"}
    </button>
  );
}
