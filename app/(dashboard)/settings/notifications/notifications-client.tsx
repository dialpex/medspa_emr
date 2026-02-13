"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon } from "lucide-react";
import {
  type NotificationTemplateItem,
  type ClinicPreviewData,
  toggleNotificationChannel,
} from "@/lib/actions/notifications";
import { NotificationSlidePanel } from "./notification-slide-panel";
import { PageCard } from "@/components/ui/page-card";
import type { NotificationTrigger } from "@prisma/client";

export type ResolvedTemplate = {
  displayId: string;
  systemTemplate: NotificationTemplateItem | null;
  override: NotificationTemplateItem | null;
  effective: NotificationTemplateItem;
  isCustomized: boolean;
  isFullyCustom: boolean;
};

function resolveTemplates(
  templates: NotificationTemplateItem[]
): ResolvedTemplate[] {
  const systemTemplates = templates.filter((t) => t.isSystem);
  const overrides = templates.filter((t) => !t.isSystem && t.systemKey);
  const fullyCustom = templates.filter((t) => !t.isSystem && !t.systemKey);

  const overrideMap = new Map<string, NotificationTemplateItem>();
  for (const o of overrides) {
    if (o.systemKey) overrideMap.set(o.systemKey, o);
  }

  const resolved: ResolvedTemplate[] = [];

  for (const sys of systemTemplates) {
    const override = sys.key ? overrideMap.get(sys.key) : undefined;
    resolved.push({
      displayId: sys.id,
      systemTemplate: sys,
      override: override || null,
      effective: override || sys,
      isCustomized: !!override,
      isFullyCustom: false,
    });
  }

  for (const custom of fullyCustom) {
    resolved.push({
      displayId: custom.id,
      systemTemplate: null,
      override: null,
      effective: custom,
      isCustomized: false,
      isFullyCustom: true,
    });
  }

  return resolved;
}

export function NotificationsClient({
  templates,
  clinicPreview,
}: {
  templates: NotificationTemplateItem[];
  clinicPreview: ClinicPreviewData;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<
    | { type: "create"; trigger: NotificationTrigger }
    | { type: "edit"; resolved: ResolvedTemplate }
  >({ type: "create", trigger: "PreAppointment" });

  const resolved = resolveTemplates(templates);
  const preTemplates = resolved.filter(
    (r) => r.effective.trigger === "PreAppointment"
  );
  const postTemplates = resolved.filter(
    (r) => r.effective.trigger === "PostAppointment"
  );

  function openCreate(trigger: NotificationTrigger) {
    setPanelMode({ type: "create", trigger });
    setPanelOpen(true);
  }

  function openEdit(item: ResolvedTemplate) {
    setPanelMode({ type: "edit", resolved: item });
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
  }

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        <PageCard label="Configuration" title="Patient Notifications">
          <div className="space-y-8">
            <NotificationSection
              title="Pre-appointment"
              items={preTemplates}
              onEdit={openEdit}
              onAdd={() => openCreate("PreAppointment")}
            />
            <NotificationSection
              title="Post-appointment"
              items={postTemplates}
              onEdit={openEdit}
              onAdd={() => openCreate("PostAppointment")}
            />
          </div>
        </PageCard>
      </div>

      <NotificationSlidePanel
        isOpen={panelOpen}
        onClose={closePanel}
        mode={panelMode}
        clinicPreview={clinicPreview}
      />
    </>
  );
}

function NotificationSection({
  title,
  items,
  onEdit,
  onAdd,
}: {
  title: string;
  items: ResolvedTemplate[];
  onEdit: (item: ResolvedTemplate) => void;
  onAdd: () => void;
}) {
  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4">
        {items.map((item) => (
          <NotificationRow
            key={item.displayId}
            item={item}
            onEdit={() => onEdit(item)}
          />
        ))}
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors mt-2"
        >
          <PlusIcon className="h-4 w-4" />
          Add custom notification
        </button>
      </div>
    </div>
  );
}

function NotificationRow({
  item,
  onEdit,
}: {
  item: ResolvedTemplate;
  onEdit: () => void;
}) {
  const { effective } = item;

  return (
    <div className="flex items-center justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 text-sm">
          {effective.name}
        </p>
        {effective.description && (
          <p className="text-sm text-gray-400 italic mt-0.5">
            {effective.description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-5 ml-6 shrink-0">
        <ChannelCheckbox item={item} channel="email" label="Email" />
        <ChannelCheckbox item={item} channel="text" label="Text" />
        <button
          onClick={onEdit}
          className="p-1 text-gray-500 hover:text-purple-600 transition-colors"
          title="Edit notification"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ChannelCheckbox({
  item,
  channel,
  label,
}: {
  item: ResolvedTemplate;
  channel: "email" | "text";
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { effective } = item;
  const checked =
    channel === "email" ? effective.emailEnabled : effective.textEnabled;

  function handleToggle() {
    startTransition(async () => {
      await toggleNotificationChannel(effective.id, channel);
      router.refresh();
    });
  }

  return (
    <label
      className={`flex items-center gap-1.5 cursor-pointer select-none ${
        isPending ? "opacity-50" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={handleToggle}
        disabled={isPending}
        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
      />
      <span className="text-sm text-gray-600">{label}</span>
    </label>
  );
}
