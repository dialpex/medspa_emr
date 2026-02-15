"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PlusIcon,
  Mail,
  MessageSquare,
  MoreVertical,
  HelpCircle,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  type NotificationTemplateItem,
  type ClinicPreviewData,
  deleteNotificationTemplate,
  toggleNotificationActive,
} from "@/lib/actions/notifications";
import { NotificationSlidePanel } from "./notification-slide-panel";
import { PageCard } from "@/components/ui/page-card";
import type { NotificationTrigger, TimingUnit } from "@prisma/client";

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

function formatTiming(
  trigger: NotificationTrigger,
  offsetValue: number,
  offsetUnit: TimingUnit
): string {
  const unitLabel = offsetUnit.toLowerCase();

  if (offsetValue === 0) {
    if (trigger === "PreAppointment") {
      return "Immediately after appointment creation";
    }
    return "Immediately after appointment checkout";
  }

  if (trigger === "PreAppointment") {
    return `Scheduled ${offsetValue} ${unitLabel} before start time`;
  }
  return `${offsetValue} ${unitLabel} after appointment checkout`;
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

  const [confirmDelete, setConfirmDelete] = useState<ResolvedTemplate | null>(
    null
  );

  function closePanel() {
    setPanelOpen(false);
  }

  const preActiveCount = preTemplates.filter(
    (r) => r.effective.isActive
  ).length;
  const postActiveCount = postTemplates.filter(
    (r) => r.effective.isActive
  ).length;

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        {/* Breadcrumb + top bar */}
        <div className="flex items-center justify-between">
          <nav className="flex items-center gap-1.5 text-sm text-gray-500">
            <Link href="/settings" className="hover:text-gray-700">Settings</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-gray-900 font-medium">
              Patient Notifications
            </span>
          </nav>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <HelpCircle className="h-4 w-4" />
              Help Center
            </button>
            <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors">
              Save Changes
            </button>
          </div>
        </div>

        {/* Main card */}
        <PageCard label="Configuration Engine" title="Patient Notifications">
          <p className="text-sm text-gray-500 -mt-2 mb-6">
            Configure automated notifications for appointment reminders,
            follow-ups, and patient engagement workflows.
          </p>

          <div className="space-y-0">
            {/* Pre-appointment Triggers */}
            <NotificationSection
              title="Pre-appointment Triggers"
              description="Notifications sent before a scheduled appointment to remind and prepare patients."
              activeCount={preActiveCount}
              items={preTemplates}
              onEdit={openEdit}
              onDelete={(item) => setConfirmDelete(item)}
              onAdd={() => openCreate("PreAppointment")}
              addLabel="Configure New Pre-Appointment Notification"
            />

            <hr className="my-8 border-gray-200" />

            {/* Post-appointment Triggers */}
            <NotificationSection
              title="Post-appointment Triggers"
              description="Follow-up messages sent after appointments to collect feedback and encourage rebooking."
              activeCount={postActiveCount}
              items={postTemplates}
              onEdit={openEdit}
              onDelete={(item) => setConfirmDelete(item)}
              onAdd={() => openCreate("PostAppointment")}
              addLabel="Add Post-Appointment Follow-up Sequence"
            />

            {/* AI Smart Suggestion */}
            <div className="mt-8 rounded-xl border border-purple-100 bg-purple-50/50 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-purple-100 p-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    AI Smart Suggestion
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Based on your no-show rate of 12%, we recommend adding a
                    same-day reminder 2 hours before appointments. Clinics with
                    similar profiles saw a 34% reduction in no-shows.
                  </p>
                  <button className="text-sm font-bold text-purple-600 hover:text-purple-700 mt-2 transition-colors">
                    Generate Draft
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Gateway Status footer */}
          <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Gateway Status: Online
              </span>
              <span>Last synchronized: 2 mins ago</span>
            </div>
            <span>
              All changes are automatically saved to your draft workspace.
            </span>
          </div>
        </PageCard>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Volume" value="1,248" sub="Last 30 days" />
          <StatCard
            label="Delivery Rate"
            value="98.2%"
            sub="Across all channels"
          />
          <StatCard
            label="Opt-out Rate"
            value="0.4%"
            sub="Industry avg: 1.2%"
          />
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <DeleteConfirmDialog
          item={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => setConfirmDelete(null)}
        />
      )}

      <NotificationSlidePanel
        isOpen={panelOpen}
        onClose={closePanel}
        mode={panelMode}
        clinicPreview={clinicPreview}
      />
    </>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function NotificationSection({
  title,
  description,
  activeCount,
  items,
  onEdit,
  onDelete,
  onAdd,
  addLabel,
}: {
  title: string;
  description: string;
  activeCount: number;
  items: ResolvedTemplate[];
  onEdit: (item: ResolvedTemplate) => void;
  onDelete: (item: ResolvedTemplate) => void;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-gray-900" />
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
        </div>
        <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5">
          {activeCount} Active Item{activeCount !== 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4 ml-4">{description}</p>

      <div className="space-y-3">
        {items.map((item) => (
          <NotificationCard
            key={item.displayId}
            item={item}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item)}
          />
        ))}

        {/* Dashed add button */}
        <button
          onClick={onAdd}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 flex items-center justify-center gap-2 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          {addLabel}
        </button>
      </div>
    </div>
  );
}

function NotificationCard({
  item,
  onEdit,
  onDelete,
}: {
  item: ResolvedTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { effective } = item;
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isToggling, startToggle] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function handleToggleActive() {
    setMenuOpen(false);
    startToggle(async () => {
      await toggleNotificationActive(effective.id);
      router.refresh();
    });
  }

  const icon = effective.emailEnabled ? (
    <Mail className="h-5 w-5 text-gray-500" />
  ) : (
    <MessageSquare className="h-5 w-5 text-gray-500" />
  );

  const timing = formatTiming(
    effective.trigger,
    effective.offsetValue,
    effective.offsetUnit
  );

  return (
    <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-4">
      <div className="rounded-lg bg-gray-100 p-2.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{effective.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{timing}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {effective.isActive ? (
          <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
            Active
          </span>
        ) : (
          <span className="text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">
            Inactive
          </span>
        )}

        {/* Three-dot menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleToggleActive}
                disabled={isToggling}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {effective.isActive ? "Deactivate" : "Activate"}
              </button>
              {item.isFullyCustom && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmDialog({
  item,
  onCancel,
  onConfirm,
}: {
  item: ResolvedTemplate;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteNotificationTemplate(item.effective.id);
      if (result.success) {
        onConfirm();
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Delete notification
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete &ldquo;{item.effective.name}&rdquo;?
          This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isPending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
