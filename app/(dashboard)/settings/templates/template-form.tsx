"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, GripVerticalIcon } from "lucide-react";
import type { TemplateFieldConfig, FieldType } from "@/lib/types/charts";
import { createTemplate, updateTemplate } from "@/lib/actions/chart-templates";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "select", label: "Select" },
  { value: "multiselect", label: "Multi-select" },
  { value: "number", label: "Number" },
  { value: "json-areas", label: "Area Picker" },
  { value: "json-products", label: "Product Rows" },
];

interface TemplateFormProps {
  template?: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    fieldsConfig: string;
    isActive: boolean;
  };
}

export function TemplateForm({ template }: TemplateFormProps) {
  const router = useRouter();
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [category, setCategory] = useState(template?.category ?? "");
  const [fields, setFields] = useState<TemplateFieldConfig[]>(
    template ? JSON.parse(template.fieldsConfig) : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addField = () => {
    setFields([
      ...fields,
      { key: `field_${Date.now()}`, label: "", type: "text", required: false },
    ]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<TemplateFieldConfig>) => {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const moveField = (from: number, to: number) => {
    if (to < 0 || to >= fields.length) return;
    const newFields = [...fields];
    const [moved] = newFields.splice(from, 1);
    newFields.splice(to, 0, moved);
    setFields(newFields);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");

    const input = {
      name: name.trim(),
      description: description.trim() || undefined,
      category: category.trim() || undefined,
      fieldsConfig: fields,
    };

    const result = template
      ? await updateTemplate(template.id, input)
      : await createTemplate(input);

    if (result.success) {
      router.push("/settings/templates");
      router.refresh();
    } else {
      setError(result.error ?? "Failed to save template");
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            placeholder="e.g. Neurotoxin Treatment"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            placeholder="e.g. Injectables"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          placeholder="Brief description of this template"
        />
      </div>

      {/* Fields Editor */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Fields</h3>
          <button
            type="button"
            onClick={addField}
            className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
          >
            <PlusIcon className="size-4" />
            Add Field
          </button>
        </div>

        <div className="space-y-3">
          {fields.map((field, i) => (
            <div
              key={field.key}
              className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border"
            >
              <div className="flex flex-col gap-1 pt-2">
                <button
                  type="button"
                  onClick={() => moveField(i, i - 1)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Move up"
                >
                  <GripVerticalIcon className="size-4" />
                </button>
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => {
                    const label = e.target.value;
                    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
                    updateField(i, { label, key });
                  }}
                  placeholder="Field label"
                  className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
                <select
                  value={field.type}
                  onChange={(e) => updateField(i, { type: e.target.value as FieldType })}
                  className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {(field.type === "select" || field.type === "multiselect" || field.type === "json-areas") && (
                  <input
                    type="text"
                    value={field.options?.join(", ") ?? ""}
                    onChange={(e) =>
                      updateField(i, {
                        options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="Options (comma-separated)"
                    className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                )}
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={field.required ?? false}
                    onChange={(e) => updateField(i, { required: e.target.checked })}
                  />
                  Required
                </label>
              </div>
              <button
                type="button"
                onClick={() => removeField(i)}
                className="p-1 text-gray-400 hover:text-red-500"
              >
                <Trash2Icon className="size-4" />
              </button>
            </div>
          ))}

          {fields.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No fields yet. Click &quot;Add Field&quot; to get started.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : template ? "Update Template" : "Create Template"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/settings/templates")}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
