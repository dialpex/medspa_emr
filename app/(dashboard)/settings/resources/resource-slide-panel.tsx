"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XIcon, Loader2Icon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import {
  createRoom,
  updateRoom,
  createResource,
  updateResource,
  type SettingsItem,
} from "@/lib/actions/resources";

const COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
  "#eab308", // yellow
  "#f97316", // orange
];

const ROOM_CATEGORIES = [
  "Treatment Room",
  "Consultation Room",
  "Recovery Room",
  "Waiting Area",
  "Other",
];

const RESOURCE_CATEGORIES = [
  "Laser",
  "CoolSculpting",
  "IPL Device",
  "RF Device",
  "Ultrasound",
  "Laser Hair Removal",
  "Other",
];

const DESC_MAX = 500;

export function ResourceSlidePanel({
  isOpen,
  onClose,
  item,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: SettingsItem | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<"Room" | "Resource">("Room");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [capacity, setCapacity] = useState("one");
  const [maxConcurrent, setMaxConcurrent] = useState(1);

  const isEditing = !!item;
  const categories = type === "Room" ? ROOM_CATEGORIES : RESOURCE_CATEGORIES;

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (item) {
        setType(item.type);
        setName(item.name);
        setCategory(item.category ?? "");
        setDescription(item.description ?? "");
        setColor(item.color ?? null);
        setCapacity(item.capacity);
        setMaxConcurrent(item.maxConcurrent);
      } else {
        setType("Room");
        setName("");
        setCategory("");
        setDescription("");
        setColor(null);
        setCapacity("one");
        setMaxConcurrent(1);
      }
    }
  }, [isOpen, item]);

  // Reset category when type changes (only on create)
  useEffect(() => {
    if (!isEditing) {
      setCategory("");
    }
  }, [type, isEditing]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    const input = {
      name: trimmedName,
      description: description.trim() || undefined,
      category: category || undefined,
      color: color || undefined,
      capacity,
      maxConcurrent: capacity === "specific" ? maxConcurrent : 1,
    };

    startTransition(async () => {
      try {
        if (isEditing) {
          if (item.type === "Room") {
            await updateRoom(item.id, input);
          } else {
            await updateResource(item.id, input);
          }
        } else {
          if (type === "Room") {
            await createRoom(input);
          } else {
            await createResource(input);
          }
        }
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1";
  const sectionClass =
    "rounded-xl border border-gray-200 bg-white p-5 space-y-4";

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
              {isEditing ? `Edit ${item.type}` : "New Room / Resource"}
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
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Section 1: Details */}
            <div className={sectionClass}>
              <h3 className="text-sm font-semibold text-gray-900">Details</h3>

              <div>
                <label className={labelClass}>Type *</label>
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as "Room" | "Resource")
                  }
                  className={inputClass}
                  disabled={isEditing}
                >
                  <option value="Room">Room</option>
                  <option value="Resource">Resource (Equipment)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder={
                    type === "Room"
                      ? "e.g. Treatment Room 1"
                      : "e.g. CoolSculpting Machine"
                  }
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a category</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Description
                  <span className="ml-2 text-gray-400 font-normal">
                    {description.length}/{DESC_MAX}
                  </span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    if (e.target.value.length <= DESC_MAX) {
                      setDescription(e.target.value);
                    }
                  }}
                  rows={3}
                  className={inputClass}
                  placeholder="Optional description"
                  maxLength={DESC_MAX}
                />
              </div>

              <div>
                <label className={labelClass}>Color on calendar</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(color === c ? null : c)}
                      className={`w-8 h-8 rounded-full transition-all ${
                        color === c
                          ? "ring-2 ring-offset-2 ring-purple-500 scale-110"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Capacity</label>
                <div className="flex justify-center">
                  <div className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-gray-100">
                    {([
                      { value: "one", label: "Single" },
                      { value: "specific", label: "Multiple" },
                      { value: "unlimited", label: "No limit" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCapacity(opt.value)}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                          capacity === opt.value
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {capacity === "specific" && (
                  <div className="mt-3">
                    <label className={labelClass}>Max concurrent appointments</label>
                    <input
                      type="number"
                      min={2}
                      max={100}
                      value={maxConcurrent}
                      onChange={(e) =>
                        setMaxConcurrent(
                          Math.max(2, parseInt(e.target.value) || 2)
                        )
                      }
                      className={`${inputClass} w-24`}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Assigned Services (edit only) */}
            {isEditing && (
              <div className={sectionClass}>
                <h3 className="text-sm font-semibold text-gray-900">
                  Assigned Services
                </h3>
                <p className="text-sm text-gray-500">
                  To assign this resource to services, go to Service Settings.
                </p>
                <Link
                  href="/settings/services"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700"
                >
                  Go to Service Settings
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
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
                : isEditing
                  ? `Update ${item.type}`
                  : "Create"}
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

