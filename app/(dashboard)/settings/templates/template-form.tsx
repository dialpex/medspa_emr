"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2Icon,
  GripVerticalIcon,
  EyeIcon,
  XIcon,
  TypeIcon,
  AlignLeftIcon,
  ListIcon,
  ListChecksIcon,
  CalendarIcon,
  PenToolIcon,
  ImageIcon,
  ImagePlusIcon,
  HeadingIcon,
  SettingsIcon,
  CopyIcon,
  UserIcon,
} from "lucide-react";
import type { TemplateFieldConfig, FieldType } from "@/lib/types/charts";
import { createTemplate, updateTemplate } from "@/lib/actions/chart-templates";
import { RichTextEditor } from "@/components/rich-text-editor";

/* ------------------------------------------------------------------ */
/*  Block palette definition                                          */
/* ------------------------------------------------------------------ */

const BLOCK_PALETTE: {
  group: string;
  items: { type: FieldType; label: string; icon: React.ElementType; description: string }[];
}[] = [
  {
    group: "Patient Info",
    items: [
      { type: "first-name", label: "First Name", icon: UserIcon, description: "Patient first name" },
      { type: "last-name", label: "Last Name", icon: UserIcon, description: "Patient last name" },
      { type: "date", label: "Date", icon: CalendarIcon, description: "Date picker" },
    ],
  },
  {
    group: "Text & Body",
    items: [
      { type: "heading", label: "Section Heading", icon: HeadingIcon, description: "Title to divide sections" },
      { type: "text", label: "Short Text", icon: TypeIcon, description: "Single-line input" },
      { type: "textarea", label: "Long Text", icon: AlignLeftIcon, description: "Multi-line paragraph" },
    ],
  },
  {
    group: "Choices",
    items: [
      { type: "select", label: "Dropdown", icon: ListIcon, description: "Pick one option" },
      { type: "multiselect", label: "Multi-select", icon: ListChecksIcon, description: "Pick multiple options" },
      { type: "checklist", label: "Checklist", icon: ListChecksIcon, description: "Check off items" },
    ],
  },
  {
    group: "Media & Signature",
    items: [
      { type: "signature", label: "Signature", icon: PenToolIcon, description: "Signature capture pad" },
      { type: "photo-single", label: "Photo", icon: ImageIcon, description: "Single photo upload" },
      { type: "logo", label: "Logo", icon: ImagePlusIcon, description: "Clinic or medspa logo" },
    ],
  },
];

const ALL_BLOCKS = BLOCK_PALETTE.flatMap((g) => g.items);

function blockMeta(type: FieldType) {
  return ALL_BLOCKS.find((b) => b.type === type) ?? ALL_BLOCKS[0];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

let fieldCounter = 0;
function newFieldKey() {
  return `field_${Date.now()}_${++fieldCounter}`;
}

function needsOptions(type: FieldType) {
  return ["select", "multiselect", "checklist", "json-areas"].includes(type);
}

/* ------------------------------------------------------------------ */
/*  Tooltip                                                           */
/* ------------------------------------------------------------------ */

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity z-50">
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
        {label}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Single block editor                                               */
/* ------------------------------------------------------------------ */

function BlockEditor({
  field,
  index,
  onUpdate,
  onRemove,
  onDuplicate,
  dragHandlers,
  isDragging,
}: {
  field: TemplateFieldConfig;
  index: number;
  onUpdate: (updates: Partial<TemplateFieldConfig>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  dragHandlers: {
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDrop: (e: React.DragEvent) => void;
  };
  isDragging: boolean;
}) {
  const meta = blockMeta(field.type);
  const Icon = meta.icon;
  const [expanded, setExpanded] = useState(!field.label);

  return (
    <div
      draggable
      onDragStart={dragHandlers.onDragStart}
      onDragOver={dragHandlers.onDragOver}
      onDragEnd={dragHandlers.onDragEnd}
      onDrop={dragHandlers.onDrop}
      style={{ transition: "transform 150ms ease, opacity 150ms ease, box-shadow 150ms ease" }}
      className={`group rounded-xl border bg-white shadow-sm ${
        isDragging
          ? "border-purple-400 ring-2 ring-purple-100 opacity-40"
          : "border-gray-200 hover:shadow-md"
      }`}
    >
      {/* Header bar — always visible */}
      <div className="flex items-center gap-2 px-3 py-2.5 min-w-0">
        <div className="cursor-grab active:cursor-grabbing shrink-0 p-0.5 text-gray-300 hover:text-gray-500">
          <GripVerticalIcon className="size-4" />
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-50 text-purple-600 shrink-0">
          <Icon className="size-3.5" />
        </div>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide shrink-0">
          {meta.label}
        </span>
        <span className="text-sm text-gray-900 font-medium truncate flex-1 min-w-0">
          {field.label || <span className="text-gray-400 italic font-normal">Untitled</span>}
        </span>

        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip label="Settings">
            <button type="button" onClick={() => setExpanded(!expanded)}
              className="p-1 text-gray-400 hover:text-gray-600">
              <SettingsIcon className="size-4" />
            </button>
          </Tooltip>
          <Tooltip label="Duplicate">
            <button type="button" onClick={onDuplicate}
              className="p-1 text-gray-400 hover:text-purple-600">
              <CopyIcon className="size-4" />
            </button>
          </Tooltip>
          <Tooltip label="Delete">
            <button type="button" onClick={onRemove}
              className="p-1 text-gray-400 hover:text-red-500">
              <Trash2Icon className="size-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Expanded config panel */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50/50 rounded-b-xl">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {field.type === "textarea" ? "Content" : "Label"}
            </label>
            {field.type === "textarea" ? (
              <RichTextEditor
                content={field.label}
                onChange={(html) => onUpdate({ label: html })}
                placeholder="Enter your text content..."
              />
            ) : (
              <input
                type="text"
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                placeholder={meta.label}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                autoFocus={!field.label}
              />
            )}
          </div>

          {needsOptions(field.type) && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Options
              </label>
              <OptionsEditor
                options={field.options ?? []}
                onChange={(options) => onUpdate({ options })}
                placeholder={field.type === "checklist" ? "e.g. Reviewed history, Verified identity" : "e.g. Option A, Option B"}
              />
            </div>
          )}

          {field.type === "photo-pair" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Left label</label>
                <input
                  type="text"
                  value={field.photoLabels?.[0] ?? "Before"}
                  onChange={(e) =>
                    onUpdate({ photoLabels: [e.target.value, field.photoLabels?.[1] ?? "After"] })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Right label</label>
                <input
                  type="text"
                  value={field.photoLabels?.[1] ?? "After"}
                  onChange={(e) =>
                    onUpdate({ photoLabels: [field.photoLabels?.[0] ?? "Before", e.target.value] })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {field.type !== "heading" && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={field.required ?? false}
                onChange={(e) => onUpdate({ required: e.target.checked })}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              Required
            </label>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Options editor — tag-style instead of comma-delimited string      */
/* ------------------------------------------------------------------ */

function OptionsEditor({
  options,
  onChange,
  placeholder,
}: {
  options: string[];
  onChange: (opts: string[]) => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addOption = () => {
    const val = inputRef.current?.value.trim();
    if (val && !options.includes(val)) {
      onChange([...options, val]);
    }
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-lg border border-gray-300 bg-white p-2">
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {options.map((opt, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
            >
              {opt}
              <button type="button" onClick={() => removeOption(i)}
                className="text-gray-400 hover:text-red-500 ml-0.5">
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          className="flex-1 border-0 bg-transparent px-1 py-0.5 text-sm focus:outline-none focus:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addOption();
            }
          }}
        />
        <button type="button" onClick={addOption}
          className="text-xs font-medium text-purple-600 hover:text-purple-700 shrink-0">
          Add
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Preview modal                                                     */
/* ------------------------------------------------------------------ */

function PreviewField({ field }: { field: TemplateFieldConfig }) {
  const label = field.label || "";
  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white";

  if (field.type === "heading") {
    return (
      <div className="pt-4 pb-1 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">{label || "Untitled Section"}</h3>
      </div>
    );
  }

  if (field.type === "textarea") {
    // Long text: render the label as rich HTML content
    return (
      <div
        className="prose prose-sm max-w-none text-gray-800 break-words"
        dangerouslySetInnerHTML={{ __html: label || "<p>No content</p>" }}
      />
    );
  }

  if (field.type === "first-name") {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">{label || "First Name"}</p>
        <input type="text" disabled placeholder="First Name" className={inputClass} />
      </div>
    );
  }

  if (field.type === "last-name") {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">{label || "Last Name"}</p>
        <input type="text" disabled placeholder="Last Name" className={inputClass} />
      </div>
    );
  }

  if (field.type === "text") {
    return <input type="text" disabled placeholder={label} className={inputClass} />;
  }

  if (field.type === "number") {
    return <input type="number" disabled placeholder={label || "0"} className={inputClass} />;
  }

  if (field.type === "date") {
    return (
      <div>
        {label && <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>}
        <input type="date" disabled className={inputClass} />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        {label && <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>}
        <select disabled className={inputClass}>
          <option>Select...</option>
          {field.options?.map((o) => <option key={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (field.type === "multiselect" || field.type === "json-areas") {
    return (
      <div>
        {label && <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>}
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((opt) => (
            <span key={opt} className="px-3 py-1.5 text-sm rounded-full border border-gray-300 text-gray-600">
              {opt}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "checklist") {
    return (
      <div>
        {label && <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>}
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" disabled className="rounded border-gray-300" />
              {opt}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "signature") {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 h-[120px] flex items-center justify-center text-sm text-gray-400">
        Signature pad
      </div>
    );
  }

  if (field.type === "photo-single") {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 h-[120px] flex items-center justify-center text-sm text-gray-400">
        Photo upload
      </div>
    );
  }

  if (field.type === "logo") {
    return (
      <div className="flex justify-center">
        <div className="rounded-lg border-2 border-dashed border-gray-300 h-[80px] w-[200px] flex items-center justify-center text-sm text-gray-400">
          Logo
        </div>
      </div>
    );
  }

  if (field.type === "photo-pair") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {(field.photoLabels ?? ["Before", "After"]).map((lbl) => (
          <div key={lbl} className="rounded-lg border-2 border-dashed border-gray-300 h-[120px] flex flex-col items-center justify-center text-sm text-gray-400">
            {lbl}
          </div>
        ))}
      </div>
    );
  }

  if (field.type === "json-products") {
    return (
      <div>
        {label && <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>}
        <div className="rounded-lg border border-gray-300 p-3">
          <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-500 mb-2">
            <span>Product</span><span>Lot #</span><span>Expiry</span><span>Qty</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <input type="text" disabled placeholder="—" className="rounded border border-gray-200 px-2 py-1 text-sm" />
            <input type="text" disabled placeholder="—" className="rounded border border-gray-200 px-2 py-1 text-sm" />
            <input type="text" disabled placeholder="—" className="rounded border border-gray-200 px-2 py-1 text-sm" />
            <input type="text" disabled placeholder="—" className="rounded border border-gray-200 px-2 py-1 text-sm" />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function PreviewModal({
  name,
  fields,
  onClose,
}: {
  name: string;
  fields: TemplateFieldConfig[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <p className="text-xs font-medium text-purple-600 uppercase tracking-wide">Preview</p>
            <h2 className="text-lg font-semibold text-gray-900">{name || "Untitled Template"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <XIcon className="size-5" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4">
          {fields.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No fields to preview. Add some blocks first.</p>
          ) : (
            <div className="space-y-5">
              {fields.map((field) => (
                <PreviewField key={field.key} field={field} />
              ))}
            </div>
          )}
        </div>
        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main form                                                         */
/* ------------------------------------------------------------------ */

interface TemplateFormProps {
  template?: {
    id: string;
    type: string;
    name: string;
    description: string | null;
    category: string | null;
    fieldsConfig: string;
    status: string;
  };
  initialFields?: TemplateFieldConfig[];
  importMeta?: { name?: string; type?: string; category?: string };
}

export function TemplateForm({ template, initialFields, importMeta }: TemplateFormProps) {
  const router = useRouter();
  const [type, setType] = useState(template?.type ?? importMeta?.type ?? "chart");
  const [name, setName] = useState(template?.name ?? importMeta?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [category, setCategory] = useState(template?.category ?? importMeta?.category ?? "");
  const [fields, setFields] = useState<TemplateFieldConfig[]>(() => {
    if (initialFields && initialFields.length > 0) return initialFields;
    if (!template) return [];
    const parsed = JSON.parse(template.fieldsConfig) as TemplateFieldConfig[];
    return parsed.map((f, i) => ({ ...f, key: f.key || `field_init_${i}` }));
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const addBlock = useCallback((blockType: FieldType) => {
    const defaultLabels: Partial<Record<FieldType, string>> = {
      "first-name": "First Name",
      "last-name": "Last Name",
    };
    const newField: TemplateFieldConfig = {
      key: newFieldKey(),
      label: defaultLabels[blockType] ?? "",
      type: blockType,
      required: false,
      ...(needsOptions(blockType) ? { options: [] } : {}),
      ...(blockType === "photo-pair" ? { photoLabels: ["Before", "After"] as [string, string] } : {}),
    };
    setFields((prev) => [...prev, newField]);
  }, []);

  const updateField = useCallback((index: number, updates: Partial<TemplateFieldConfig>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  }, []);

  const removeField = useCallback((index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const duplicateField = useCallback((index: number) => {
    setFields((prev) => {
      const original = prev[index];
      const copy = { ...original, key: newFieldKey(), label: original.label };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  }, []);

  // Drag-and-drop reorder state — live reorder on drag
  const dragIndexRef = useRef<number | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const throttleRef = useRef(false);

  const handleDragStart = useCallback((index: number) => (e: React.DragEvent) => {
    dragIndexRef.current = index;
    setDraggingKey(fields[index]?.key ?? null);
    e.dataTransfer.effectAllowed = "move";
  }, [fields]);

  const handleDragOver = useCallback((_overIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const fromIndex = dragIndexRef.current;
    if (fromIndex === null || throttleRef.current) return;

    // Find which block the cursor is over by checking element midpoints
    const target = (e.currentTarget as HTMLElement);
    const rect = target.getBoundingClientRect();
    const mouseY = e.clientY;
    const midpoint = rect.top + rect.height / 2;

    // Determine the actual index of this element
    const container = target.parentElement;
    if (!container) return;
    const children = Array.from(container.children).filter(
      (el) => el instanceof HTMLElement && el.draggable
    );
    const overIndex = children.indexOf(target);
    if (overIndex === -1 || overIndex === fromIndex) return;

    // Only swap if cursor has crossed the midpoint in the right direction
    const movingDown = fromIndex < overIndex;
    if (movingDown && mouseY < midpoint) return;
    if (!movingDown && mouseY > midpoint) return;

    // Throttle to prevent rapid re-renders
    throttleRef.current = true;
    setTimeout(() => { throttleRef.current = false; }, 100);

    setFields((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(overIndex, 0, moved);
      return next;
    });
    dragIndexRef.current = overIndex;
  }, []);

  const handleDrop = useCallback((_dropIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null;
    setDraggingKey(null);
    throttleRef.current = false;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");

    // Generate stable keys from labels before saving
    const cleanedFields = fields.map((f) => ({
      ...f,
      key: f.label ? f.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || f.key : f.key,
    }));

    const input = {
      type,
      name: name.trim(),
      description: description.trim() || undefined,
      category: category.trim() || undefined,
      fieldsConfig: cleanedFields,
    };

    const result = template
      ? await updateTemplate(template.id, input)
      : await createTemplate(input);

    if (result.success) {
      setSuccess(true);
      setSaving(false);
      router.push("/settings/templates");
    } else {
      setError(result.error ?? "Failed to save template");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="p-3 text-sm text-green-700 bg-green-50 rounded-lg flex items-center gap-2">
          <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Saved successfully. Redirecting&hellip;
        </div>
      )}

      {/* Type selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
        <div className="flex gap-3">
          {[
            { value: "chart", title: "Chart", desc: "Clinical documentation for treatments" },
            { value: "form", title: "Form / Consent", desc: "Intake forms, consents, questionnaires" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className={`flex-1 p-3 rounded-lg border text-left transition-colors ${
                type === opt.value
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="text-sm font-medium text-gray-900">{opt.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Meta fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            placeholder="e.g. Neurotoxin Treatment"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
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
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          placeholder="Brief description of this template"
        />
      </div>

      {/* ---- Block builder ---- */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Form Fields</h3>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6">
          {/* Canvas — current fields */}
          <div className="space-y-2 min-h-[120px] min-w-0">
            {fields.length === 0 && (
              <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
                <p className="text-sm text-gray-400">
                  Click a block from the palette to start building your form.
                </p>
              </div>
            )}
            {fields.map((field, i) => (
              <BlockEditor
                key={field.key}
                field={field}
                index={i}
                onUpdate={(u) => updateField(i, u)}
                onRemove={() => removeField(i)}
                onDuplicate={() => duplicateField(i)}
                isDragging={draggingKey === field.key}
                dragHandlers={{
                  onDragStart: handleDragStart(i),
                  onDragOver: handleDragOver(i),
                  onDrop: handleDrop(i),
                  onDragEnd: handleDragEnd,
                }}
              />
            ))}
          </div>

          {/* Palette sidebar */}
          <div className="lg:sticky lg:top-6 space-y-4 self-start">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add block</p>
            {BLOCK_PALETTE.map((group) => (
              <div key={group.group}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  {group.group}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => addBlock(item.type)}
                        className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white p-2.5 text-center hover:border-purple-300 hover:bg-purple-50 transition-colors"
                      >
                        <Icon className="size-4 text-gray-500" />
                        <span className="text-[11px] font-medium text-gray-700 leading-tight">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-4 border-t">
        <button
          type="submit"
          disabled={saving || success}
          className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving && (
            <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {saving ? "Saving..." : success ? "Saved!" : template ? "Update Template" : "Create Template"}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-1.5"
        >
          <EyeIcon className="size-4" />
          Preview
        </button>
        <button
          type="button"
          onClick={() => router.push("/settings/templates")}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>

      {showPreview && (
        <PreviewModal
          name={name}
          fields={fields}
          onClose={() => setShowPreview(false)}
        />
      )}
    </form>
  );
}
