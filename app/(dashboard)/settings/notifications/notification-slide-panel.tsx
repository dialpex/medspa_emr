"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { XIcon, Loader2Icon, TrashIcon, RotateCcwIcon } from "lucide-react";
import {
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  resetNotificationTemplate,
  type NotificationTemplateItem,
  type ClinicPreviewData,
} from "@/lib/actions/notifications";
import type { NotificationTrigger, TimingUnit } from "@prisma/client";
import { RichTextEditor } from "@/components/rich-text-editor";
import type { ResolvedTemplate } from "./notifications-client";

const BODY_MAX = 500;

const VARIABLES = [
  { label: "{{firstName}}", value: "{{firstName}}" },
  { label: "{{lastName}}", value: "{{lastName}}" },
  { label: "{{appointmentTime}}", value: "{{appointmentTime}}" },
  { label: "{{appointmentDate}}", value: "{{appointmentDate}}" },
  { label: "{{reviewLink}}", value: "{{reviewLink}}" },
  { label: "{{clinicName}}", value: "{{clinicName}}" },
];

function buildSampleValues(clinicPreview: ClinicPreviewData): Record<string, string> {
  return {
    "{{firstName}}": "Jennifer",
    "{{lastName}}": "Williams",
    "{{appointmentTime}}": "10:00 AM",
    "{{appointmentDate}}": "Feb 13, 2026",
    "{{reviewLink}}": clinicPreview.reviewLink || "https://g.page/review/example",
    "{{clinicName}}": clinicPreview.clinicName || "Your Clinic",
  };
}

function renderPreview(bodyText: string, sampleValues: Record<string, string>): string {
  let result = bodyText;
  for (const [key, value] of Object.entries(sampleValues)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

type PanelMode =
  | { type: "create"; trigger: NotificationTrigger }
  | { type: "edit"; resolved: ResolvedTemplate };

export function NotificationSlidePanel({
  isOpen,
  onClose,
  mode,
  clinicPreview,
}: {
  isOpen: boolean;
  onClose: () => void;
  mode: PanelMode;
  clinicPreview: ClinicPreviewData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState<NotificationTrigger>("PreAppointment");
  const [offsetValue, setOffsetValue] = useState<number | "">("");
  const [offsetUnit, setOffsetUnit] = useState<TimingUnit>("Hours");
  const [bodyText, setBodyText] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [editorTab, setEditorTab] = useState<"text" | "email">("text");
  // Key to force remount RichTextEditor when panel opens with new content
  const [editorKey, setEditorKey] = useState(0);

  const isCreate = mode.type === "create";
  const resolved = mode.type === "edit" ? mode.resolved : null;
  const isSystemEdit = resolved ? !resolved.isFullyCustom && !!resolved.systemTemplate : false;
  const isCustomOverride = resolved?.isCustomized ?? false;
  const isFullyCustom = resolved?.isFullyCustom ?? false;

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (mode.type === "edit") {
        setEditorTab(mode.resolved.effective.emailEnabled ? "email" : "text");
        const eff = mode.resolved.effective;
        setName(eff.name);
        setDescription(eff.description || "");
        setTrigger(eff.trigger);
        setOffsetValue(eff.offsetValue);
        setOffsetUnit(eff.offsetUnit);
        setBodyText(eff.bodyText);
        setBodyHtml(eff.bodyHtml || eff.bodyText);
      } else {
        setEditorTab("text");
        setName("");
        setDescription("");
        setTrigger(mode.trigger);
        setOffsetValue("");
        setOffsetUnit("Hours");
        setBodyText("");
        setBodyHtml("");
      }
      setEditorKey((k) => k + 1);
    }
  }, [isOpen, mode]);

  function insertVariable(variable: string) {
    if (editorTab === "text") {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText =
        bodyText.substring(0, start) + variable + bodyText.substring(end);
      if (newText.length <= BODY_MAX) {
        setBodyText(newText);
        requestAnimationFrame(() => {
          textarea.focus();
          const newPos = start + variable.length;
          textarea.setSelectionRange(newPos, newPos);
        });
      }
    } else {
      setBodyHtml((prev) => prev + variable);
      setEditorKey((k) => k + 1);
    }
  }

  function showError(msg: string) {
    setError(msg);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numericOffset = offsetValue === "" ? 0 : offsetValue;

    // Auto-derive plain text from HTML if text body is empty but HTML has content
    let effectiveBodyText = bodyText.trim();
    if (!effectiveBodyText && bodyHtml.trim()) {
      effectiveBodyText = stripHtml(bodyHtml);
    }

    const input = {
      name: name.trim(),
      description: description.trim() || undefined,
      trigger,
      offsetValue: numericOffset,
      offsetUnit,
      bodyText: effectiveBodyText,
      bodyHtml: bodyHtml.trim() || undefined,
      emailEnabled: editorTab === "email",
      textEnabled: editorTab === "text",
    };

    if (!input.name) {
      showError("Name is required");
      return;
    }
    if (!input.bodyText) {
      showError("Message body is required");
      return;
    }

    startTransition(async () => {
      try {
        let result;
        if (isCreate) {
          result = await createNotificationTemplate(input);
        } else if (resolved) {
          const targetId = isSystemEdit && !isCustomOverride
            ? resolved.systemTemplate!.id
            : resolved.effective.id;
          result = await updateNotificationTemplate(targetId, input);
        }
        if (result && !result.success) {
          showError(result.error || "Something went wrong");
          return;
        }
        onClose();
        router.refresh();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleDelete() {
    if (!resolved) return;
    startTransition(async () => {
      try {
        const result = await deleteNotificationTemplate(resolved.effective.id);
        if (!result.success) {
          showError(result.error || "Something went wrong");
          return;
        }
        onClose();
        router.refresh();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleReset() {
    if (!resolved?.systemTemplate?.key) return;
    startTransition(async () => {
      try {
        const result = await resetNotificationTemplate(
          resolved.systemTemplate!.key!
        );
        if (!result.success) {
          showError(result.error || "Something went wrong");
          return;
        }
        onClose();
        router.refresh();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  const timingDirection =
    trigger === "PreAppointment" ? "before" : "after";
  const timingLabel =
    offsetValue === "" || offsetValue === 0
      ? trigger === "PreAppointment"
        ? "immediately when booked"
        : "immediately after"
      : `${offsetValue} ${offsetUnit.toLowerCase()} ${timingDirection}`;

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1";
  const sectionClass =
    "rounded-xl border border-gray-200 bg-white p-5 space-y-4";

  const sampleValues = buildSampleValues(clinicPreview);

  const panelTitle = isCreate
    ? "New Notification"
    : `Edit ${resolved?.effective.name || "Notification"}`;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 right-0 z-50 h-full w-[480px] max-w-full bg-gray-50 shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
            <h2 className="text-lg font-semibold text-gray-900">
              {panelTitle}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <XIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Details */}
            <div className={sectionClass}>
              <h3 className="text-sm font-semibold text-gray-900">Details</h3>

              <div>
                <label className={labelClass}>Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Appointment Reminder"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Sends 2 days before the appointment"
                />
              </div>

              <div>
                <label className={labelClass}>Trigger Type *</label>
                <select
                  value={trigger}
                  onChange={(e) =>
                    setTrigger(e.target.value as NotificationTrigger)
                  }
                  className={inputClass}
                  disabled={isSystemEdit && !isCreate}
                >
                  <option value="PreAppointment">Pre-Appointment</option>
                  <option value="PostAppointment">Post-Appointment</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Timing *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    value={offsetValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setOffsetValue("");
                      } else {
                        setOffsetValue(Math.max(0, parseInt(val) || 0));
                      }
                    }}
                    placeholder="0"
                    className={`${inputClass} w-24`}
                  />
                  <select
                    value={offsetUnit}
                    onChange={(e) =>
                      setOffsetUnit(e.target.value as TimingUnit)
                    }
                    className={inputClass}
                  >
                    <option value="Minutes">Minutes</option>
                    <option value="Hours">Hours</option>
                    <option value="Days">Days</option>
                  </select>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Sends {timingLabel} the appointment
                </p>
              </div>
            </div>

            {/* Message */}
            <div className={sectionClass}>
              <h3 className="text-sm font-semibold text-gray-900">Message</h3>

              {/* Tab switcher */}
              <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setEditorTab("text")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    editorTab === "text"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Text (SMS)
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab("email")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    editorTab === "email"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Email (Rich Text)
                </button>
              </div>

              {/* Text (SMS) editor */}
              {editorTab === "text" && (
                <div>
                  <label className={labelClass}>
                    Text Message *
                    <span className="ml-2 text-gray-400 font-normal">
                      {bodyText.length}/{BODY_MAX}
                    </span>
                  </label>
                  <textarea
                    ref={textareaRef}
                    value={bodyText}
                    onChange={(e) => {
                      if (e.target.value.length <= BODY_MAX) {
                        setBodyText(e.target.value);
                      }
                    }}
                    rows={5}
                    className={inputClass}
                    placeholder="Type your notification message..."
                    maxLength={BODY_MAX}
                  />
                </div>
              )}

              {/* Email (rich text) editor */}
              {editorTab === "email" && (
                <div>
                  <label className={labelClass}>Email Body</label>
                  <RichTextEditor
                    key={editorKey}
                    content={bodyHtml}
                    onChange={(html) => setBodyHtml(html)}
                    placeholder="Type your email notification..."
                  />
                </div>
              )}

              <div>
                <label className={labelClass}>Insert Variable</label>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => insertVariable(v.value)}
                      className="rounded-md bg-gray-100 px-2 py-1 text-xs font-mono text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {bodyText.trim() && editorTab === "text" && (
                <div>
                  <label className={labelClass}>Preview</label>
                  <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                    {renderPreview(bodyText, sampleValues)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 flex items-center gap-3 bg-white">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
              {isPending
                ? "Saving..."
                : isCreate
                  ? "Create"
                  : "Save"}
            </button>
            {/* Reset to default — only for customized system templates */}
            {!isCreate && isCustomOverride && isSystemEdit && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RotateCcwIcon className="h-4 w-4" />
                Reset to default
              </button>
            )}
            {/* Delete — only for fully custom templates */}
            {!isCreate && isFullyCustom && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
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
