"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { XIcon } from "lucide-react";
import {
  createService,
  updateService,
  ServiceItem,
  TemplateOption,
} from "@/lib/actions/services";

const CATEGORIES = [
  "Injectables",
  "Skin Care",
  "Laser",
  "Body Contouring",
  "Wellness",
  "Other",
];

export function ServiceForm({
  service,
  templates,
}: {
  service?: ServiceItem;
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [category, setCategory] = useState(service?.category ?? "");
  const [duration, setDuration] = useState(service?.duration ?? 30);
  const [price, setPrice] = useState(service?.price ?? 0);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>(
    service?.templateIds ?? []
  );

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

    const input = {
      name: name.trim(),
      description: description.trim() || undefined,
      category: category || undefined,
      duration,
      price,
      templateIds: selectedTemplateIds,
    };

    if (!input.name) {
      setError("Name is required");
      return;
    }

    startTransition(async () => {
      try {
        if (service) {
          await updateService(service.id, input);
        } else {
          await createService(input);
        }
        router.push("/settings/services");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function typeLabel(type: string) {
    if (type === "chart") return "Chart";
    if (type === "form") return "Form";
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="">Select a category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            required
          />
        </div>
      </div>

      {/* Template associations */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Forms & Charts
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Select forms, charts, or consents to send when this service is booked.
        </p>

        {selectedTemplateIds.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
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
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {isPending ? "Saving..." : service ? "Update Service" : "Create Service"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/settings/services")}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
