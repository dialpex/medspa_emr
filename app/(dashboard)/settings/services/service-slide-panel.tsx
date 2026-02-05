"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XIcon, Loader2Icon } from "lucide-react";
import {
  createService,
  updateService,
  type ServiceItem,
  type TemplateOption,
} from "@/lib/actions/services";

const CATEGORIES = [
  "Injectables",
  "Skin Care",
  "Laser",
  "Body Contouring",
  "Wellness",
  "Other",
];

function typeLabel(type: string) {
  if (type === "chart") return "Chart";
  if (type === "form") return "Form";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function ServiceSlidePanel({
  isOpen,
  onClose,
  service,
  templates,
}: {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceItem | null;
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

  // Reset form when service changes or panel opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (service) {
        setName(service.name);
        setDescription(service.description ?? "");
        setCategory(service.category ?? "");
        setDuration(service.duration.toString());
        setPrice(service.price.toString());
        setSelectedTemplateIds(service.templateIds);
      } else {
        setName("");
        setDescription("");
        setCategory("");
        setDuration("30");
        setPrice("");
        setSelectedTemplateIds([]);
      }
    }
  }, [isOpen, service]);

  function addTemplate(id: string) {
    if (id && !selectedTemplateIds.includes(id)) {
      setSelectedTemplateIds([...selectedTemplateIds, id]);
    }
  }

  function removeTemplate(id: string) {
    setSelectedTemplateIds(selectedTemplateIds.filter((t) => t !== id));
  }

  const availableTemplates = templates.filter(
    (t) => !selectedTemplateIds.includes(t.id)
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Service name is required");
      return;
    }

    const dur = parseInt(duration) || 0;
    const p = parseFloat(price) || 0;

    if (dur < 1) {
      setError("Duration must be at least 1 minute");
      return;
    }
    if (p < 0) {
      setError("Price cannot be negative");
      return;
    }

    const input = {
      name: trimmedName,
      description: description.trim() || undefined,
      category: category || undefined,
      duration: dur,
      price: p,
      templateIds: selectedTemplateIds,
    };

    startTransition(async () => {
      try {
        if (service) {
          await updateService(service.id, input);
        } else {
          await createService(input);
        }
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  const isEditing = !!service;

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

      {/* Slide panel from right */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[480px] max-w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? "Edit Service" : "New Service"}
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
                  placeholder="Service name"
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
            </section>

            {/* Pricing & Duration */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Pricing & Duration
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Duration (min) *</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className={inputClass}
                    placeholder="30"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Price ($) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className={inputClass}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
            </section>

            {/* Forms & Charts */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Forms & Charts
              </h3>
              <p className="text-xs text-gray-500">
                Select forms or charts to associate when this service is booked.
              </p>

              {selectedTemplateIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedTemplateIds.map((id) => {
                    const t = templates.find((tpl) => tpl.id === id);
                    if (!t) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700"
                      >
                        <span className="text-purple-400 mr-0.5">
                          {typeLabel(t.type)}:
                        </span>
                        {t.name}
                        <button
                          type="button"
                          onClick={() => removeTemplate(id)}
                          className="ml-0.5 text-purple-400 hover:text-purple-600"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {availableTemplates.length > 0 && (
                <select
                  value=""
                  onChange={(e) => addTemplate(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Add a form or chart...</option>
                  {availableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {typeLabel(t.type)}: {t.name}
                    </option>
                  ))}
                </select>
              )}

              {templates.length === 0 && (
                <p className="text-xs text-gray-400">
                  No templates available. Create templates in Forms & Charts settings first.
                </p>
              )}
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
              {isPending ? "Saving..." : isEditing ? "Update Service" : "Create Service"}
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
