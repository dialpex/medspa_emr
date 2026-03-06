"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  CopyIcon,
  UserIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  MousePointerClickIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import { type TemplateFieldConfig, type FieldType, type FormSection, groupFieldsIntoRows, groupFieldsBySections } from "@/lib/types/charts";
import { createTemplate, updateTemplate } from "@/lib/actions/chart-templates";
import { RichTextEditor } from "@/components/rich-text-editor";
import { FieldPreview } from "@/components/field-preview";
import { ChartFormFields } from "@/app/(dashboard)/charts/[id]/edit/chart-form-fields";

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
      { type: "photo-single", label: "Photo", icon: ImageIcon, description: "Single photo upload" },
      { type: "photo-pair", label: "Before / After", icon: ImagePlusIcon, description: "Before & after photo pair" },
      { type: "signature", label: "Signature", icon: PenToolIcon, description: "Signature capture pad" },
      { type: "logo", label: "Logo", icon: ImagePlusIcon, description: "Auto-filled from clinic settings" },
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

/** Fields that support a placeholder property */
function supportsPlaceholder(type: FieldType) {
  return ["text", "number", "first-name", "last-name", "date", "textarea"].includes(type);
}

function createField(blockType: FieldType, width?: number, section?: FormSection): TemplateFieldConfig {
  const defaultLabels: Partial<Record<FieldType, string>> = {
    "first-name": "First Name",
    "last-name": "Last Name",
  };
  return {
    key: newFieldKey(),
    label: defaultLabels[blockType] ?? "",
    type: blockType,
    required: false,
    ...(needsOptions(blockType) ? { options: [] } : {}),
    ...(blockType === "photo-pair" ? { photoLabels: ["Before", "After"] as [string, string] } : {}),
    ...(width !== undefined && width < 100 ? { width } : {}),
    ...(section ? { section } : {}),
  };
}

/** Snap a width value to 5% increments, clamped to [25, 100] */
function snapWidth(w: number): number {
  return Math.max(25, Math.min(100, Math.round(w / 5) * 5));
}

/* ------------------------------------------------------------------ */
/*  Drop target type                                                   */
/* ------------------------------------------------------------------ */

type DropTarget =
  | { type: "between"; index: number; section: FormSection }
  | { type: "beside"; flatIndex: number; side: "left" | "right" }
  | { type: "section"; section: FormSection };

/* ------------------------------------------------------------------ */
/*  Options editor                                                    */
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

  const removeOption = (value: string) => {
    onChange(options.filter((o) => o !== value));
  };

  return (
    <div className="rounded-lg border border-gray-300 bg-white p-2">
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {options.map((opt) => (
            <span
              key={opt}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
            >
              {opt}
              <button type="button" onClick={() => removeOption(opt)}
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
/*  Canvas field — WYSIWYG preview with selection + resize handles     */
/* ------------------------------------------------------------------ */

function CanvasField({
  field,
  flatIndex,
  isSelected,
  onSelect,
  onUpdate,
  onDragStart,
  isDragging,
  dropSide,
  clinicLogoUrl,
}: {
  field: TemplateFieldConfig;
  flatIndex: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<TemplateFieldConfig>) => void;
  onDragStart: (e: React.DragEvent) => void;
  isDragging: boolean;
  dropSide: "left" | "right" | null;
  clinicLogoUrl?: string;
}) {
  const elRef = useRef<HTMLDivElement>(null);

  // Right-edge resize state
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const el = elRef.current?.closest("[data-visual-row]") as HTMLElement | null;
    if (!el) return;
    const containerWidth = el.getBoundingClientRect().width;
    const startX = e.clientX;
    const startWidth = field.width ?? 100;

    const handleMouseMove = (ev: MouseEvent) => {
      const deltaPx = ev.clientX - startX;
      const deltaPct = (deltaPx / containerWidth) * 100;
      const newWidth = snapWidth(startWidth + deltaPct);
      onUpdate({ width: newWidth === 100 ? undefined : newWidth });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [field.width, onUpdate]);

  return (
    <div
      ref={elRef}
      className={`group/field rounded bg-white transition-all duration-150 relative ${
        isDragging
          ? "opacity-40 border-2 border-purple-400 ring-2 ring-purple-100 shadow-lg"
          : isSelected
            ? "border border-gray-200 border-b-[3px] border-b-purple-600 shadow-md"
            : "border border-gray-200 hover:border-purple-200 hover:shadow-sm"
      }`}
      onClick={(e) => {
        if (!isSelected) {
          e.stopPropagation();
          onSelect();
        }
      }}
      data-field-index={flatIndex}
    >
      {/* Beside-drop indicator: left side */}
      {dropSide === "left" && (
        <div className="absolute inset-y-0 left-0 w-1/2 bg-purple-100/50 rounded-l pointer-events-none z-20 border-l-[4px] border-purple-500" />
      )}

      {/* Beside-drop indicator: right side */}
      {dropSide === "right" && (
        <div className="absolute inset-y-0 right-0 w-1/2 bg-purple-100/50 rounded-r pointer-events-none z-20 border-r-[4px] border-purple-500" />
      )}

      {/* "Editing" badge — top right */}
      {isSelected && (
        <div className="absolute top-2 right-2 z-10">
          <span className="bg-purple-600 text-white text-xs font-medium px-2.5 py-1 rounded-md inline-flex items-center gap-1">
            <SettingsIcon className="size-3" />
            Editing
          </span>
        </div>
      )}

      {/* Drag grip — small purple pill on left edge, centered vertically */}
      <div
        draggable
        onDragStart={onDragStart}
        className={`absolute top-1/2 -translate-y-1/2 -left-[10px] z-10 cursor-grab active:cursor-grabbing transition-opacity ${
          isSelected ? "opacity-100" : "opacity-0 group-hover/field:opacity-100"
        }`}
      >
        <div className={`flex items-center justify-center w-5 h-7 rounded-md ${
          isSelected ? "bg-purple-600" : "bg-gray-400"
        }`}>
          <GripVerticalIcon className="size-3 text-white" />
        </div>
      </div>

      {/* Card body */}
      <div className="min-h-[72px]">
        <div className="py-3 px-4 pr-8">
          <FieldPreview field={field} clinicLogoUrl={clinicLogoUrl} />
        </div>
      </div>

      {/* Right-edge resize handle */}
      {field.type !== "heading" && (
        <div
          onMouseDown={handleResizeMouseDown}
          className={`absolute top-0 right-0 bottom-0 w-[6px] cursor-col-resize z-20 transition-opacity ${
            isSelected || isResizing ? "opacity-100" : "opacity-0 group-hover/field:opacity-100"
          }`}
        >
          <div
            className={`absolute top-3 bottom-3 right-[1px] w-[3px] rounded-full transition-colors ${
              isResizing ? "bg-purple-500" : "bg-gray-300 hover:bg-purple-500"
            }`}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Field Properties Panel (right sidebar)                             */
/* ------------------------------------------------------------------ */

function FieldPropertiesPanel({
  field,
  onUpdate,
  onDuplicate,
  onRemove,
  panelRef,
}: {
  field: TemplateFieldConfig;
  onUpdate: (updates: Partial<TemplateFieldConfig>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  panelRef?: React.Ref<HTMLDivElement>;
}) {
  const meta = blockMeta(field.type);
  const Icon = meta.icon;

  return (
    <div
      ref={panelRef}
      data-properties-panel
      className="border-l border-gray-200 bg-white flex flex-col overflow-hidden lg:sticky lg:top-0 lg:h-[calc(100vh-140px)]"
    >
      {/* Sticky header */}
      <div className="px-4 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <SettingsIcon className="size-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Field Properties</h3>
        </div>
        <p className="text-xs text-gray-400">Configure the selected field.</p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Type indicator card */}
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-100 text-purple-600 shrink-0">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 leading-tight">{meta.label}</p>
            <p className="text-xs text-gray-400">{meta.description}</p>
          </div>
        </div>

        {/* Field Label */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            {field.type === "textarea" ? "Content" : "Field Label"}
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
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              autoFocus
            />
          )}
        </div>

        {/* Placeholder Text */}
        {supportsPlaceholder(field.type) && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Placeholder Text</label>
            <input
              type="text"
              value={field.placeholder ?? ""}
              onChange={(e) => onUpdate({ placeholder: e.target.value || undefined })}
              placeholder={`Enter ${(field.label || meta.label).toLowerCase()}...`}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        )}

        {/* Options editor for select/multiselect/checklist */}
        {needsOptions(field.type) && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Options</label>
            <OptionsEditor
              options={field.options ?? []}
              onChange={(options) => onUpdate({ options })}
              placeholder={field.type === "checklist" ? "e.g. Reviewed history" : "e.g. Option A"}
            />
          </div>
        )}

        {/* Photo pair labels */}
        {field.type === "photo-pair" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Photo Labels</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Left</label>
                <input
                  type="text"
                  value={field.photoLabels?.[0] ?? "Before"}
                  onChange={(e) => onUpdate({ photoLabels: [e.target.value, field.photoLabels?.[1] ?? "After"] })}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Right</label>
                <input
                  type="text"
                  value={field.photoLabels?.[1] ?? "After"}
                  onChange={(e) => onUpdate({ photoLabels: [field.photoLabels?.[0] ?? "Before", e.target.value] })}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Required toggle */}
        {field.type !== "heading" && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => onUpdate({ required: !field.required })}
              className="flex items-center justify-between w-full group"
            >
              <div>
                <p className="text-sm font-medium text-gray-700 text-left">Required Field</p>
                <p className="text-xs text-gray-400 text-left">User must fill this out</p>
              </div>
              <div
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  field.required ? "bg-purple-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                    field.required ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Sticky footer — Duplicate + Delete */}
      <div className="border-t border-gray-200 px-4 py-3 shrink-0 flex gap-2">
        <button
          type="button"
          onClick={onDuplicate}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <CopyIcon className="size-3.5" />
          Duplicate
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
        >
          <Trash2Icon className="size-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FieldDivider — draggable handle between adjacent fields in a row  */
/* ------------------------------------------------------------------ */

function FieldDivider({
  leftField,
  rightField,
  onUpdateLeft,
  onUpdateRight,
  containerRef,
}: {
  leftField: TemplateFieldConfig;
  rightField: TemplateFieldConfig;
  onUpdateLeft: (updates: Partial<TemplateFieldConfig>) => void;
  onUpdateRight: (updates: Partial<TemplateFieldConfig>) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [tooltipWidths, setTooltipWidths] = useState<{ left: number; right: number } | null>(null);
  const startXRef = useRef(0);
  const startLeftRef = useRef(0);
  const startRightRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startLeftRef.current = leftField.width ?? 100;
    startRightRef.current = rightField.width ?? 100;
    setTooltipWidths({ left: startLeftRef.current, right: startRightRef.current });

    const handleMouseMove = (ev: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const containerWidth = container.getBoundingClientRect().width;
      const deltaPx = ev.clientX - startXRef.current;
      const deltaPct = (deltaPx / containerWidth) * 100;

      const origLeft = startLeftRef.current;
      const origRight = startRightRef.current;
      const total = origLeft + origRight;

      let newLeft = Math.round((origLeft + deltaPct) / 5) * 5;
      let newRight = total - newLeft;

      if (newLeft < 25) { newLeft = 25; newRight = total - 25; }
      if (newRight < 25) { newRight = 25; newLeft = total - 25; }

      setTooltipWidths({ left: newLeft, right: newRight });
      onUpdateLeft({ width: newLeft === 100 ? undefined : newLeft });
      onUpdateRight({ width: newRight === 100 ? undefined : newRight });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setTooltipWidths(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="relative flex items-stretch self-stretch w-0">
      <div
        onMouseDown={handleMouseDown}
        className="absolute inset-y-0 -left-2 w-4 cursor-col-resize z-20 flex items-center justify-center group/divider"
      >
        <div
          className={`h-full w-[4px] rounded-full transition-colors ${
            isDragging
              ? "bg-purple-500"
              : "bg-transparent group-hover/divider:bg-purple-400"
          }`}
        />
      </div>
      {tooltipWidths && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 text-white text-[10px] font-medium px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none z-30">
          {tooltipWidths.left}% | {tooltipWidths.right}%
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RowDropZone — subtle empty-space indicator at end of partial rows  */
/* ------------------------------------------------------------------ */

function RowDropZone({
  remainingWidth,
  onDrop,
}: {
  remainingWidth: number;
  onDrop: (fieldType: FieldType) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsHovered(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (!el.contains(e.relatedTarget as Node)) {
      setIsHovered(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHovered(false);

    const rawData = e.dataTransfer.getData("text/plain");
    const allBlockTypes = BLOCK_PALETTE.flatMap((g) => g.items.map((i) => i.type));
    if (allBlockTypes.includes(rawData as FieldType)) {
      onDrop(rawData as FieldType);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded border-2 border-dashed flex flex-col items-center justify-center gap-1 min-h-[80px] transition-colors ${
        isHovered
          ? "border-purple-400 bg-purple-50/60"
          : "border-gray-200 bg-gray-50/20"
      }`}
    >
      <PlusIcon className={`size-4 ${isHovered ? "text-purple-500" : "text-gray-300"}`} />
      <span className={`text-[11px] font-medium ${isHovered ? "text-purple-500" : "text-gray-300"}`}>
        {remainingWidth}%
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section labels                                                     */
/* ------------------------------------------------------------------ */

const SECTION_META: Record<FormSection, {
  label: string;
  hint: string;
  icons: React.ElementType[];
  chips: { type: FieldType; label: string; icon: React.ElementType }[];
}> = {
  header: {
    label: "Header",
    hint: "Logo, heading, clinic info",
    icons: [ImagePlusIcon, HeadingIcon],
    chips: [
      { type: "logo", label: "Logo", icon: ImagePlusIcon },
      { type: "heading", label: "Heading", icon: HeadingIcon },
    ],
  },
  body: {
    label: "Body",
    hint: "Main form fields",
    icons: [],
    chips: [],
  },
  footer: {
    label: "Footer",
    hint: "Signature, disclaimers",
    icons: [PenToolIcon, AlignLeftIcon],
    chips: [
      { type: "signature", label: "Signature", icon: PenToolIcon },
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Preview modal (inline, interactive via ChartFormFields)            */
/* ------------------------------------------------------------------ */

function PreviewModal({
  name,
  fields,
  onClose,
}: {
  name: string;
  fields: TemplateFieldConfig[];
  onClose: () => void;
}) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <p className="text-xs font-medium text-purple-600 uppercase tracking-wide">Preview</p>
            <h2 className="text-lg font-semibold text-gray-900">{name || "Untitled Template"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <XIcon className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4">
          {fields.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No fields to preview. Add some blocks first.</p>
          ) : (
            <ChartFormFields
              fields={fields}
              values={formValues}
              onChange={(k, v) => setFormValues(prev => ({ ...prev, [k]: v }))}
              chartId=""
              patientId=""
            />
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 shrink-0 flex gap-3">
          <button
            type="button"
            onClick={() => setFormValues({})}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
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
  clinicLogoUrl?: string;
}

export function TemplateForm({ template, initialFields, importMeta, clinicLogoUrl }: TemplateFormProps) {
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
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null);
  const selectedField = selectedFieldKey ? fields.find(f => f.key === selectedFieldKey) ?? null : null;
  const [showDetails, setShowDetails] = useState(true);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Dirty tracking — form has unsaved work if name or fields changed
  const isDirty = name.trim() !== (template?.name ?? importMeta?.name ?? "") || fields.length > 0;

  // Block browser navigation (refresh / close tab) when dirty
  useEffect(() => {
    if (!isDirty || success) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, success]);

  // Palette group collapse state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  // Drag state — rich drop target (between rows OR beside a field)
  const [dragSource, setDragSource] = useState<"palette" | "canvas" | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const dragDataRef = useRef<{ source: "palette"; fieldType: FieldType } | { source: "canvas"; fromIndex: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Keep a ref to fields for use in callbacks without stale closures
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  const addBlock = useCallback((blockType: FieldType, atIndex?: number, section?: FormSection) => {
    const newField = createField(blockType, undefined, section);
    setFields((prev) => {
      if (atIndex !== undefined && atIndex >= 0 && atIndex <= prev.length) {
        const next = [...prev];
        next.splice(atIndex, 0, newField);
        return next;
      }
      // When adding to a section without an index, append after the last field of that section
      if (section) {
        const lastIdx = prev.reduce((acc, f, i) => {
          const fSection = f.section || "body";
          if (fSection === section) return i;
          return acc;
        }, -1);
        if (lastIdx >= 0) {
          const next = [...prev];
          next.splice(lastIdx + 1, 0, newField);
          return next;
        }
        // No fields in that section yet — find proper position based on section order
        const sectionOrder: FormSection[] = ["header", "body", "footer"];
        const sectionIdx = sectionOrder.indexOf(section);
        // Insert before first field of a later section
        for (let i = sectionIdx + 1; i < sectionOrder.length; i++) {
          const firstIdx = prev.findIndex((f) => (f.section || "body") === sectionOrder[i]);
          if (firstIdx >= 0) {
            const next = [...prev];
            next.splice(firstIdx, 0, newField);
            return next;
          }
        }
      }
      return [...prev, newField];
    });
    setSelectedFieldKey(newField.key);
  }, []);

  const updateField = useCallback((index: number, updates: Partial<TemplateFieldConfig>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  }, []);

  const removeField = useCallback((index: number) => {
    setFields((prev) => {
      const remaining = prev.filter((_, i) => i !== index);
      const nextField = remaining[index] ?? remaining[index - 1] ?? null;
      setSelectedFieldKey(nextField?.key ?? null);
      return remaining;
    });
  }, []);

  const duplicateField = useCallback((index: number) => {
    const copyKey = newFieldKey();
    setFields((prev) => {
      const original = prev[index];
      const copy = {
        ...original,
        key: copyKey,
        label: original.label,
      };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setSelectedFieldKey(copyKey);
  }, []);

  /* -- Beside drop: insert a new palette field next to an existing one -- */
  /* All fields in the row redistribute to equal widths */
  const handleBesideDrop = useCallback((fieldType: FieldType, targetFlatIndex: number, side: "left" | "right") => {
    setFields((prev) => {
      const targetField = prev[targetFlatIndex];
      if (!targetField || targetField.type === "heading") {
        const nf = createField(fieldType, undefined, targetField?.section);
        const next = [...prev];
        next.splice(side === "left" ? targetFlatIndex : targetFlatIndex + 1, 0, nf);
        setTimeout(() => setSelectedFieldKey(nf.key), 0);
        return next;
      }

      // Find the visual row this field is in (within the same section)
      const sectionFields = prev.filter((f) => (f.section || "body") === (targetField.section || "body"));
      const rows = groupFieldsIntoRows(sectionFields);
      let targetRow: TemplateFieldConfig[] | null = null;
      for (const row of rows) {
        if (row.some((f) => f === targetField)) {
          targetRow = row;
          break;
        }
      }

      const currentCount = targetRow ? targetRow.length : 1;
      const newCount = currentCount + 1;

      // Distribute equally: e.g. 2→50/50, 3→33/33/34
      const base = Math.floor(100 / newCount);
      const equalWidths = Array.from({ length: newCount }, (_, i) =>
        i === newCount - 1 ? 100 - base * (newCount - 1) : base
      );

      const next = [...prev];

      // Resize all existing fields in the row to their equal share
      if (targetRow) {
        let wi = 0;
        for (const f of targetRow) {
          const idx = next.indexOf(f);
          if (idx >= 0) {
            next[idx] = { ...next[idx], width: equalWidths[wi] };
            wi++;
          }
        }
      }

      // Insert the new field with the last equal share, inheriting section
      const nf = createField(fieldType, equalWidths[newCount - 1], targetField.section);
      const insertIdx = side === "right" ? targetFlatIndex + 1 : targetFlatIndex;
      next.splice(insertIdx, 0, nf);
      setTimeout(() => setSelectedFieldKey(nf.key), 0);
      return next;
    });
  }, []);

  /* -- Beside reorder: move an existing canvas field next to another -- */
  /* All fields in the resulting row redistribute to equal widths */
  const handleBesideReorder = useCallback((fromIndex: number, targetFlatIndex: number, side: "left" | "right") => {
    setFields((prev) => {
      if (fromIndex === targetFlatIndex) return prev;
      const targetField = prev[targetFlatIndex];
      if (!targetField || targetField.type === "heading") return prev;

      const movedField = prev[fromIndex];
      const next = [...prev];
      next.splice(fromIndex, 1);

      const adjTarget = fromIndex < targetFlatIndex ? targetFlatIndex - 1 : targetFlatIndex;
      const adjField = next[adjTarget];

      // Find the visual row after removal
      const rows = groupFieldsIntoRows(next);
      let targetRow: TemplateFieldConfig[] | null = null;
      for (const row of rows) {
        if (row.some((f) => f === adjField)) {
          targetRow = row;
          break;
        }
      }

      const currentCount = targetRow ? targetRow.length : 1;
      const newCount = currentCount + 1;

      // Distribute equally
      const base = Math.floor(100 / newCount);
      const equalWidths = Array.from({ length: newCount }, (_, i) =>
        i === newCount - 1 ? 100 - base * (newCount - 1) : base
      );

      // Resize existing fields in the row
      if (targetRow) {
        let wi = 0;
        for (const f of targetRow) {
          const idx = next.indexOf(f);
          if (idx >= 0) {
            next[idx] = { ...next[idx], width: equalWidths[wi] };
            wi++;
          }
        }
      }

      const insertIdx = side === "right" ? adjTarget + 1 : adjTarget;
      next.splice(insertIdx, 0, { ...movedField, width: equalWidths[newCount - 1], section: targetField.section });
      return next;
    });
  }, []);

  /* -- Palette drag handlers -- */
  const handlePaletteDragStart = useCallback((fieldType: FieldType) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", fieldType);
    dragDataRef.current = { source: "palette", fieldType };
    setDragSource("palette");
  }, []);

  /* -- Canvas drag handlers (reorder) -- */
  const handleCanvasDragStart = useCallback((index: number) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    dragDataRef.current = { source: "canvas", fromIndex: index };
    setDragSource("canvas");
  }, []);

  /* -- Canvas drag over — detect between-row vs beside zones -- */
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragSource === "palette" ? "copy" : "move";

    const canvas = canvasRef.current;
    if (!canvas) return;

    const fieldEls = canvas.querySelectorAll("[data-field-index]");

    // Check if cursor is directly over a field element
    for (let i = 0; i < fieldEls.length; i++) {
      const el = fieldEls[i] as HTMLElement;
      const rect = el.getBoundingClientRect();

      if (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
      ) {
        const flatIndex = parseInt(el.dataset.fieldIndex!, 10);
        const sectionEl = el.closest("[data-section]") as HTMLElement | null;
        const section = (sectionEl?.dataset.section as FormSection) || "body";
        const relX = (e.clientX - rect.left) / rect.width;
        const relY = (e.clientY - rect.top) / rect.height;

        // Narrow top/bottom bands → between-row drop (above/below)
        if (relY < 0.15) {
          setDropTarget({ type: "between", index: flatIndex, section });
          return;
        }
        if (relY > 0.85) {
          setDropTarget({ type: "between", index: flatIndex + 1, section });
          return;
        }

        // Left/right zones → beside drop
        if (relX < 0.35) {
          setDropTarget({ type: "beside", flatIndex, side: "left" });
          return;
        }
        if (relX > 0.65) {
          setDropTarget({ type: "beside", flatIndex, side: "right" });
          return;
        }

        // Center zone → between-row at closest edge
        setDropTarget({ type: "between", index: relY < 0.5 ? flatIndex : flatIndex + 1, section });
        return;
      }
    }

    // Not directly over any field — check if over an empty section zone
    const sectionZones = canvas.querySelectorAll("[data-section]");
    for (let i = 0; i < sectionZones.length; i++) {
      const el = sectionZones[i] as HTMLElement;
      const rect = el.getBoundingClientRect();
      if (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
      ) {
        const section = el.dataset.section as FormSection;
        // Check if this section has fields — if not, use section drop target
        const sectionFields = fieldsRef.current.filter(
          (f) => (f.section || "body") === section
        );
        if (sectionFields.length === 0) {
          setDropTarget({ type: "section", section });
          return;
        }
        // Section has fields — find between-row position by Y within this section
        const sectionFieldEls = el.querySelectorAll("[data-field-index]");
        let targetIndex = fieldsRef.current.length;
        for (let j = 0; j < sectionFieldEls.length; j++) {
          const fel = sectionFieldEls[j] as HTMLElement;
          const fRect = fel.getBoundingClientRect();
          if (e.clientY < fRect.top + fRect.height / 2) {
            targetIndex = parseInt(fel.dataset.fieldIndex!, 10);
            break;
          }
        }
        setDropTarget({ type: "between", index: targetIndex, section });
        return;
      }
    }

    // Fallback
    setDropTarget({ type: "between", index: fieldsRef.current.length, section: "body" });
  }, [dragSource]);

  const handleCanvasDragLeave = useCallback((e: React.DragEvent) => {
    const canvas = canvasRef.current;
    if (canvas && !canvas.contains(e.relatedTarget as Node)) {
      setDropTarget(null);
    }
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = dragDataRef.current;
    const target = dropTarget;

    if (!data) {
      setDropTarget(null);
      setDragSource(null);
      dragDataRef.current = null;
      return;
    }

    if (!target) {
      // Fallback: append at end
      if (data.source === "palette") {
        addBlock(data.fieldType);
      }
    } else if (target.type === "section") {
      if (data.source === "palette") {
        addBlock(data.fieldType, undefined, target.section);
      } else if (data.source === "canvas") {
        // Move existing field into this section
        setFields((prev) => {
          const next = [...prev];
          const [moved] = next.splice(data.fromIndex, 1);
          moved.section = target.section === "body" ? undefined : target.section;
          // Insert at end of section
          const sectionOrder: FormSection[] = ["header", "body", "footer"];
          const secIdx = sectionOrder.indexOf(target.section);
          // Find insertion point: after last field of this section, or before first field of next section
          let insertAt = next.length;
          for (let s = secIdx + 1; s < sectionOrder.length; s++) {
            const firstIdx = next.findIndex((f) => (f.section || "body") === sectionOrder[s]);
            if (firstIdx >= 0) {
              insertAt = firstIdx;
              break;
            }
          }
          next.splice(insertAt, 0, moved);
          return next;
        });
      }
    } else if (target.type === "between") {
      if (data.source === "palette") {
        addBlock(data.fieldType, target.index, target.section);
      } else if (data.source === "canvas") {
        const fromIndex = data.fromIndex;
        if (fromIndex !== target.index && fromIndex !== target.index - 1) {
          setFields((prev) => {
            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            const adjustedIdx = fromIndex < target.index ? target.index - 1 : target.index;
            // Use the section from the drop target (determined by which visual zone the cursor was in)
            moved.section = target.section === "body" ? undefined : target.section;
            next.splice(adjustedIdx, 0, moved);
            return next;
          });
        }
      }
    } else if (target.type === "beside") {
      if (data.source === "palette") {
        handleBesideDrop(data.fieldType, target.flatIndex, target.side);
      } else if (data.source === "canvas") {
        handleBesideReorder(data.fromIndex, target.flatIndex, target.side);
      }
    }

    dragDataRef.current = null;
    setDragSource(null);
    setDropTarget(null);
  }, [dropTarget, addBlock, handleBesideDrop, handleBesideReorder]);

  const handleDragEnd = useCallback(() => {
    dragDataRef.current = null;
    setDragSource(null);
    setDropTarget(null);
  }, []);

  // Handle RowDropZone drops
  const handleRowDropZoneDrop = useCallback((insertAfterIndex: number, remainingWidth: number, section?: FormSection) => (fieldType: FieldType) => {
    const newField = createField(fieldType, remainingWidth, section);
    setFields((prev) => {
      const next = [...prev];
      next.splice(insertAfterIndex + 1, 0, newField);
      return next;
    });
    setSelectedFieldKey(newField.key);
  }, []);

  // Click-away to deselect — ignore clicks on fields, config panels, or the properties panel
  const propertiesPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-field-index]") || target.closest("[data-config-panel]") || target.closest("[data-properties-panel]")) return;
      // Also check bounding rect of properties panel (catches scrollbar clicks)
      if (propertiesPanelRef.current) {
        const rect = propertiesPanelRef.current.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) return;
      }
      setSelectedFieldKey(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");

    const cleanKey = (f: TemplateFieldConfig): TemplateFieldConfig => ({
      ...f,
      key: f.label ? f.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || f.key : f.key,
    });
    const cleanedFields = fields.map(cleanKey);

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

  /* ---------------------------------------------------------------- */
  /*  Drop indicator line                                              */
  /* ---------------------------------------------------------------- */
  const DropIndicator = () => (
    <div className="flex items-center gap-2 py-0.5">
      <div className="size-2 rounded-full bg-purple-400 shrink-0" />
      <div className="h-0.5 bg-purple-400 rounded-full flex-1" />
      <div className="size-2 rounded-full bg-purple-400 shrink-0" />
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Build visual rows per section for the canvas                     */
  /* ---------------------------------------------------------------- */
  const sections = groupFieldsBySections(fields);

  function buildRowsWithIndices(sectionFields: TemplateFieldConfig[]) {
    const rows = groupFieldsIntoRows(sectionFields);
    return rows.map((row) =>
      row.map((field) => {
        const idx = fields.indexOf(field);
        return { field, flatIndex: idx };
      })
    );
  }

  // Helper: get dropSide for a given flat index
  const getDropSide = (flatIndex: number): "left" | "right" | null => {
    if (!dropTarget || dropTarget.type !== "beside") return null;
    if (dropTarget.flatIndex !== flatIndex) return null;
    return dropTarget.side;
  };

  // Helper: should show between-row indicator before this flat index?
  const showBetweenBefore = (flatIndex: number, currentSection: FormSection): boolean => {
    if (!dropTarget || dropTarget.type !== "between") return false;
    return dropTarget.index === flatIndex && dropTarget.section === currentSection && dragSource !== null;
  };

  // Helper: is a section drop target active for this section?
  const isSectionDropTarget = (section: FormSection): boolean => {
    if (!dropTarget || dropTarget.type !== "section") return false;
    return dropTarget.section === section && dragSource !== null;
  };

  /** Renders the rows for one section */
  const renderSectionRows = (section: FormSection) => {
    const sectionFields = sections[section];
    const rowsWithIndices = buildRowsWithIndices(sectionFields);

    return rowsWithIndices.map((row) => {
      const rowWidth = row.reduce((sum, { field }) => sum + (field.width ?? 100), 0);
      const hasSpace = rowWidth < 100;
      const remainingWidth = 100 - rowWidth;
      const lastFieldInRow = row[row.length - 1];

      // Single full-width field — no grid needed
      if (row.length === 1 && (row[0].field.width ?? 100) === 100) {
        const { field, flatIndex } = row[0];
        return (
          <div key={field.key} data-visual-row>
            {showBetweenBefore(flatIndex, section) && <DropIndicator />}
            <CanvasField
              field={field}
              flatIndex={flatIndex}
              isSelected={selectedFieldKey === field.key}
              onSelect={() => setSelectedFieldKey(field.key)}
              onUpdate={(u) => updateField(flatIndex, u)}
              onDragStart={handleCanvasDragStart(flatIndex)}
              isDragging={dragSource === "canvas" && dragDataRef.current?.source === "canvas" && (dragDataRef.current as { source: "canvas"; fromIndex: number }).fromIndex === flatIndex}
              dropSide={getDropSide(flatIndex)}
              clinicLogoUrl={clinicLogoUrl}
            />
          </div>
        );
      }

      // Multi-field row — grid layout
      return (
        <div key={row.map((r) => r.field.key).join("-")} data-visual-row>
          {showBetweenBefore(row[0].flatIndex, section) && <DropIndicator />}
          <div
            className="gap-1 items-stretch"
            style={{
              display: "grid",
              gridTemplateColumns: [
                ...row.map(({ field }) => `${field.width ?? 100}fr`),
                ...(hasSpace ? [`${remainingWidth}fr`] : []),
              ].join(" "),
            }}
          >
            {row.map(({ field, flatIndex }, fi) => (
              <div key={field.key} className="min-w-0 flex">
                {fi > 0 && (
                  <FieldDivider
                    leftField={row[fi - 1].field}
                    rightField={field}
                    onUpdateLeft={(u) => updateField(row[fi - 1].flatIndex, u)}
                    onUpdateRight={(u) => updateField(flatIndex, u)}
                    containerRef={canvasRef}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <CanvasField
                    field={field}
                    flatIndex={flatIndex}
                    isSelected={selectedFieldKey === field.key}
                    onSelect={() => setSelectedFieldKey(field.key)}
                    onUpdate={(u) => updateField(flatIndex, u)}
                    onDragStart={handleCanvasDragStart(flatIndex)}
                    isDragging={dragSource === "canvas" && dragDataRef.current?.source === "canvas" && (dragDataRef.current as { source: "canvas"; fromIndex: number }).fromIndex === flatIndex}
                    dropSide={getDropSide(flatIndex)}
                    clinicLogoUrl={clinicLogoUrl}
                  />
                </div>
              </div>
            ))}

            {hasSpace && (
              <RowDropZone
                remainingWidth={remainingWidth}
                onDrop={handleRowDropZoneDrop(lastFieldInRow.flatIndex, remainingWidth, section)}
              />
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* ============================================================ */}
      {/* HEADER BAR                                                    */}
      {/* ============================================================ */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3">
        {error && (
          <div className="mb-3 p-3 text-sm text-red-700 bg-red-50 rounded-lg">{error}</div>
        )}
        {success && (
          <div className="mb-3 p-3 text-sm text-green-700 bg-green-50 rounded-lg flex items-center gap-2">
            <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Saved successfully. Redirecting&hellip;
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (isDirty) setShowDiscardConfirm(true);
              else router.push("/settings/templates");
            }}
            className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 shrink-0"
          >
            <ArrowLeftIcon className="size-5" />
          </button>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Untitled Template"
            className="flex-1 text-lg font-semibold text-gray-900 bg-transparent border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-purple-500 focus:outline-none focus:ring-0 px-1 py-0.5 transition-colors"
          />

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-1.5 transition-colors"
            >
              <EyeIcon className="size-4" />
              Preview
            </button>
            <button
              type="button"
              onClick={() => {
                if (isDirty) setShowDiscardConfirm(true);
                else router.push("/settings/templates");
              }}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={saving || success}
              onClick={handleSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {saving && (
                <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {saving ? "Saving..." : success ? "Saved!" : template ? "Update" : "Save"}
            </button>
          </div>
        </div>

        {/* ---- Collapsible metadata row ---- */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showDetails ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
            Details
          </button>

          {showDetails && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                {[
                  { value: "chart", label: "Chart" },
                  { value: "form", label: "Form / Consent" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      type === opt.value
                        ? "bg-white text-purple-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category"
                className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 bg-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 w-40"
              />

              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 bg-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 flex-1 min-w-[200px]"
              />
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* BUILDER: PALETTE (left) + CANVAS (right)                      */}
      {/* ============================================================ */}
      <div className={`flex-1 grid grid-cols-1 min-h-0 ${
        selectedField
          ? "lg:grid-cols-[260px_1fr_300px]"
          : "lg:grid-cols-[260px_1fr]"
      }`}>

        {/* ---- PALETTE SIDEBAR ---- */}
        <div className="border-r border-gray-200 bg-gray-50/50 overflow-y-auto lg:sticky lg:top-0 lg:h-[calc(100vh-140px)]">
          <div className="p-4 space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Add Fields</p>

            {BLOCK_PALETTE.map((group) => {
              const isCollapsed = collapsedGroups.has(group.group);
              return (
                <div key={group.group} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.group)}
                    className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRightIcon className="size-3.5" />
                    ) : (
                      <ChevronDownIcon className="size-3.5" />
                    )}
                    {group.group}
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-1.5 mt-1.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.type}
                            type="button"
                            draggable
                            onDragStart={handlePaletteDragStart(item.type)}
                            onDragEnd={handleDragEnd}
                            className="flex items-center gap-3 w-full rounded border border-gray-200 bg-white px-3 py-2.5 text-left hover:border-purple-300 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing group/item"
                          >
                            <div className="flex h-7 w-7 items-center justify-center rounded bg-gray-50 text-gray-400 group-hover/item:text-purple-600 group-hover/item:bg-purple-50 shrink-0 transition-colors">
                              <Icon className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-700 group-hover/item:text-gray-900 leading-tight">
                                {item.label}
                              </div>
                            </div>
                            <GripVerticalIcon className="size-4 text-gray-300 group-hover/item:text-gray-400 shrink-0 transition-colors" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- CANVAS ---- */}
        <div
          ref={canvasRef}
          className="overflow-y-auto bg-gray-100 p-8 lg:h-[calc(100vh-140px)]"
          onDragOver={handleCanvasDragOver}
          onDragLeave={handleCanvasDragLeave}
          onDrop={handleCanvasDrop}
        >
          <div className="max-w-3xl mx-auto bg-white border border-gray-200 shadow-sm rounded min-h-[600px] p-8 flex flex-col">
            {(["header", "body", "footer"] as FormSection[]).map((section, si) => {
              const meta = SECTION_META[section];
              const sectionFields = sections[section];
              const isEmpty = sectionFields.length === 0;
              const isDropping = isSectionDropTarget(section);
              // For the last field in this section, get its flat index for drop indicator
              const lastField = sectionFields[sectionFields.length - 1];
              const lastFlatIndex = lastField ? fields.indexOf(lastField) : -1;
              const showEndIndicator =
                dropTarget?.type === "between" &&
                dropTarget.section === section &&
                dragSource !== null &&
                lastFlatIndex >= 0 &&
                dropTarget.index === lastFlatIndex + 1;

              // Flex proportions: header=1, body=2, footer=1
              const flexVal = section === "body" ? "2" : "1";

              return (
                <div key={section} className={`flex flex-col ${si > 0 ? "mt-6" : ""}`} style={{ flex: isEmpty ? flexVal : "0 0 auto" }}>
                  {/* Section zone as fieldset with legend-style label */}
                  <fieldset
                    data-section={section}
                    className={`flex flex-col border-2 border-dashed rounded transition-colors p-3 ${isEmpty ? "flex-1" : ""} ${
                      isEmpty && isDropping
                        ? "border-purple-400 bg-purple-50/40"
                        : isEmpty && dragSource !== null
                          ? "border-purple-200 bg-purple-50/20"
                          : isEmpty && section !== "body"
                            ? "border-gray-200 bg-gray-50/50"
                            : "border-gray-200"
                    }`}
                  >
                    <legend className="px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {meta.label}
                    </legend>

                    {/* Section content or empty state */}
                    {isEmpty ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-2">
                        {isDropping ? (
                          <p className="text-sm font-medium text-purple-500">
                            Drop here to add to {meta.label}
                          </p>
                        ) : section === "body" ? (
                          <>
                            <div className="flex h-14 w-14 items-center justify-center rounded bg-purple-50 text-purple-400 mb-2">
                              <MousePointerClickIcon className="size-7" />
                            </div>
                            <p className="text-base font-medium text-gray-500 mb-1">
                              Start building your template
                            </p>
                            <p className="text-sm text-gray-400">
                              Drag fields from the palette to add
                            </p>
                          </>
                        ) : (
                          <>
                            {meta.icons.length > 0 && (
                              <div className="flex items-center gap-3">
                                {meta.icons.map((Icon, i) => (
                                  <Icon key={i} className="size-5 text-gray-300" />
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-gray-300">
                              {meta.hint}
                            </p>
                            {!dragSource && meta.chips.length > 0 && (
                              <div className="flex items-center gap-2 mt-1">
                                {meta.chips.map((chip) => {
                                  const ChipIcon = chip.icon;
                                  return (
                                    <button
                                      key={chip.type}
                                      type="button"
                                      onClick={() => addBlock(chip.type, undefined, section)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border border-gray-200 text-gray-400 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer"
                                    >
                                      <ChipIcon className="size-3.5" />
                                      {chip.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {renderSectionRows(section)}

                        {/* Drop indicator at end of section */}
                        {showEndIndicator && <DropIndicator />}
                      </div>
                    )}
                  </fieldset>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- PROPERTIES PANEL (right) ---- */}
        {selectedField && (
          <FieldPropertiesPanel
            field={selectedField}
            onUpdate={(u) => updateField(fields.indexOf(selectedField), u)}
            onDuplicate={() => duplicateField(fields.indexOf(selectedField))}
            onRemove={() => removeField(fields.indexOf(selectedField))}
            panelRef={propertiesPanelRef}
          />
        )}
      </div>

      {showPreview && (
        <PreviewModal
          name={name}
          fields={fields}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDiscardConfirm(false)} />
          <div className="relative bg-white rounded shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Discard changes?</h3>
            <p className="text-sm text-gray-500 mb-5">
              You have unsaved changes. Are you sure you want to leave? Your work will be lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => router.push("/settings/templates")}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
