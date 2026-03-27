"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XIcon, Loader2Icon, Repeat } from "lucide-react";
import { ScrollTimePicker } from "@/components/scroll-time-picker";
import {
  createBlockTime,
  deleteRecurringAppointment,
  type Provider,
  type RecurrenceRule,
} from "@/lib/actions/appointments";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  providers: Provider[];
  initialStartTime?: Date;
  initialEndTime?: Date;
};

const PRESET_TITLES = ["Lunch", "Break", "Staff Meeting", "Admin Time", "Personal", "Training"];

export function BlockTimeForm({
  isOpen,
  onClose,
  providers,
  initialStartTime,
  initialEndTime,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("Lunch");
  const [providerId, setProviderId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  // Recurrence
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState<RecurrenceRule["frequency"]>("weekdays");
  const [repeatEndType, setRepeatEndType] = useState<RecurrenceRule["endType"]>("count");
  const [repeatEndCount, setRepeatEndCount] = useState(5);
  const [repeatEndDate, setRepeatEndDate] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setTitle("Lunch");
    setProviderId(providers[0]?.id || "");
    setStartTime(formatDateTimeLocal(snapTo15Min(initialStartTime || new Date())));
    setEndTime(formatDateTimeLocal(snapTo15Min(initialEndTime || addMinutes(new Date(), 60))));
    setNotes("");
    setRepeatEnabled(false);
    setRepeatFrequency("weekdays");
    setRepeatEndType("count");
    setRepeatEndCount(5);
    setRepeatEndDate("");
  }, [isOpen, initialStartTime, initialEndTime, providers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Please enter a title");
      return;
    }
    if (!providerId) {
      setError("Please select a provider");
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      setError("End time must be after start time");
      return;
    }

    startTransition(async () => {
      try {
        const recurrence = repeatEnabled
          ? {
              frequency: repeatFrequency,
              endType: repeatEndType,
              ...(repeatEndType === "count" && { endCount: repeatEndCount }),
              ...(repeatEndType === "date" && { endDate: repeatEndDate }),
            } as RecurrenceRule
          : undefined;

        const result = await createBlockTime({
          title: title.trim(),
          providerId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          notes: notes || undefined,
          recurrence,
        });

        if (!result.success) {
          setError(result.error || "Failed to create block time");
          return;
        }

        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    });
  };

  if (!isOpen) return null;

  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Block Time</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">{error}</div>
          )}

          {/* Title presets */}
          <div>
            <label className={labelClass}>Title *</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_TITLES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTitle(preset)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    title === preset
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="Custom title..."
            />
          </div>

          {/* Provider */}
          <div>
            <label className={labelClass}>Provider *</label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select provider...</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className={labelClass}>Date *</label>
            <input
              type="date"
              value={startTime.split("T")[0] || ""}
              onChange={(e) => {
                const date = e.target.value;
                const startPart = startTime.split("T")[1] || "12:00";
                const endPart = endTime.split("T")[1] || "13:00";
                setStartTime(`${date}T${startPart}`);
                setEndTime(`${date}T${endPart}`);
              }}
              className={inputClass}
              required
            />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Start *</label>
              <ScrollTimePicker
                value={startTime.split("T")[1]?.slice(0, 5) || "12:00"}
                onChange={(time) => {
                  const date = startTime.split("T")[0] || "";
                  setStartTime(`${date}T${time}`);
                }}
              />
            </div>
            <div>
              <label className={labelClass}>End *</label>
              <ScrollTimePicker
                value={endTime.split("T")[1]?.slice(0, 5) || "13:00"}
                onChange={(time) => {
                  const date = endTime.split("T")[0] || "";
                  setEndTime(`${date}T${time}`);
                }}
              />
            </div>
          </div>

          {/* Repeat */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={repeatEnabled}
                onChange={(e) => setRepeatEnabled(e.target.checked)}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <Repeat className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Repeat</span>
            </label>
            {repeatEnabled && (
              <div className="mt-3 space-y-3 pl-6 border-l-2 border-gray-100">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Frequency</label>
                  <select
                    value={repeatFrequency}
                    onChange={(e) => setRepeatFrequency(e.target.value as RecurrenceRule["frequency"])}
                    className={inputClass}
                  >
                    <option value="daily">Every day</option>
                    <option value="weekdays">Every weekday (Mon-Fri)</option>
                    <option value="weekly">Every week</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Every month</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ends</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="blockRepeatEnd" checked={repeatEndType === "count"} onChange={() => setRepeatEndType("count")} className="text-gray-900 focus:ring-gray-900" />
                      <span className="text-sm text-gray-700">After</span>
                      <input type="number" min={2} max={52} value={repeatEndCount} onChange={(e) => setRepeatEndCount(Math.min(52, Math.max(2, parseInt(e.target.value) || 2)))} className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" disabled={repeatEndType !== "count"} />
                      <span className="text-sm text-gray-700">times</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="blockRepeatEnd" checked={repeatEndType === "date"} onChange={() => setRepeatEndType("date")} className="text-gray-900 focus:ring-gray-900" />
                      <span className="text-sm text-gray-700">On date</span>
                      <input type="date" value={repeatEndDate} onChange={(e) => setRepeatEndDate(e.target.value)} className="px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" disabled={repeatEndType !== "date"} />
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="blockRepeatEnd" checked={repeatEndType === "never"} onChange={() => setRepeatEndType("never")} className="text-gray-900 focus:ring-gray-900" />
                      <span className="text-sm text-gray-700">Never (max 52)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${inputClass} resize-none`}
              placeholder="Optional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} disabled={isPending} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
              {repeatEnabled ? "Create Series" : "Block Time"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatDateTimeLocal(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

function snapTo15Min(date: Date): Date {
  const d = new Date(date);
  const minutes = d.getMinutes();
  const snapped = Math.round(minutes / 15) * 15;
  d.setMinutes(snapped, 0, 0);
  return d;
}
