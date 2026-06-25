"use client";

import { useState } from "react";
import { ClipboardListIcon, PlusIcon, XIcon } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import type { TemplateFieldConfig } from "@/lib/types/charts";

function parseJson<T>(val: string, fallback: T): T {
  try { return JSON.parse(val); } catch { return fallback; }
}

// --- Field keys/types consumed or removed by this card ---

const CONSUMED_KEYS = new Set(["areas", "products", "treatment_checklist", "aftercare", "treatment_date"]);
const CONSUMED_TYPES = new Set(["json-areas", "json-products", "checklist"]);
const REMOVED_KEYS = new Set(["allergies", "technique", "total_units"]);
const REMOVED_TYPES = new Set(["photo-pair", "photo-single"]);

export function isConsumedByProcedureDetails(field: TemplateFieldConfig): boolean {
  return CONSUMED_KEYS.has(field.key) || CONSUMED_TYPES.has(field.type);
}

export function isRemovedField(field: TemplateFieldConfig): boolean {
  return REMOVED_KEYS.has(field.key) || REMOVED_TYPES.has(field.type);
}

// --- Sub-components ---

function AreaPicker({
  options,
  value,
  onChange,
  disabled,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const [customInput, setCustomInput] = useState("");
  const allOptions = [...options, ...value.filter((v) => !options.includes(v))];

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed && !allOptions.includes(trimmed)) {
      onChange([...value, trimmed]);
    } else if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setCustomInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {allOptions.map((opt) => {
          const selected = value.includes(opt);
          const isCustom = !options.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange(selected ? value.filter((v) => v !== opt) : [...value, opt])
              }
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                selected
                  ? "bg-purple-100 border-purple-300 text-purple-700"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {opt}
              {isCustom && selected && !disabled && (
                <XIcon className="inline ml-1 h-3 w-3" />
              )}
            </button>
          );
        })}
      </div>
      {!disabled && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder="Add custom area..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!customInput.trim()}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function ProductRows({
  value,
  onChange,
  disabled,
}: {
  value: Array<{ name: string; lot: string; expiration: string; quantity: string }>;
  onChange: (v: Array<{ name: string; lot: string; expiration: string; quantity: string }>) => void;
  disabled?: boolean;
}) {
  const addRow = () =>
    onChange([...value, { name: "", lot: "", expiration: "", quantity: "" }]);
  const removeRow = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: string, val: string) =>
    onChange(value.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));

  return (
    <div className="space-y-2">
      {value.map((row, i) => (
        <div key={i} className="grid grid-cols-4 gap-2">
          <input
            type="text"
            value={row.name}
            onChange={(e) => updateRow(i, "name", e.target.value)}
            placeholder="Product name"
            disabled={disabled}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
          />
          <input
            type="text"
            value={row.lot}
            onChange={(e) => updateRow(i, "lot", e.target.value)}
            placeholder="Lot #"
            disabled={disabled}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
          />
          <input
            type="text"
            value={row.expiration}
            onChange={(e) => updateRow(i, "expiration", e.target.value)}
            placeholder="Expiration"
            disabled={disabled}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
          />
          <div className="flex gap-1">
            <input
              type="text"
              value={row.quantity}
              onChange={(e) => updateRow(i, "quantity", e.target.value)}
              placeholder="Qty/Units"
              disabled={disabled}
              className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
            />
            {!disabled && (
              <button type="button" onClick={() => removeRow(i)} className="px-2 text-red-400 hover:text-red-600">
                ×
              </button>
            )}
          </div>
        </div>
      ))}
      {!disabled && (
        <button type="button" onClick={addRow} className="text-sm text-purple-600 hover:text-purple-700">
          + Add Product
        </button>
      )}
    </div>
  );
}

function ChecklistField({
  options,
  value,
  onChange,
  disabled,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const checked = value.includes(opt);
        return (
          <label
            key={opt}
            className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
              checked ? "bg-green-50 border-green-200" : "bg-white border-gray-200 hover:bg-gray-50"
            } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() =>
                onChange(checked ? value.filter((v) => v !== opt) : [...value, opt])
              }
              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

// --- Main Component ---

interface ProcedureDetailsCardProps {
  chiefComplaint: string;
  onChiefComplaintChange: (value: string) => void;
  additionalNotes: string;
  onAdditionalNotesChange: (value: string) => void;
  templateFields: TemplateFieldConfig[];
  templateValues: Record<string, string>;
  onTemplateChange: (key: string, value: string) => void;
  disabled?: boolean;
}

export function ProcedureDetailsCard({
  chiefComplaint,
  onChiefComplaintChange,
  additionalNotes,
  onAdditionalNotesChange,
  templateFields,
  templateValues,
  onTemplateChange,
  disabled,
}: ProcedureDetailsCardProps) {
  const areasField = templateFields.find((f) => f.type === "json-areas");
  const productsField = templateFields.find((f) => f.type === "json-products");
  const checklistField = templateFields.find((f) => f.type === "checklist");
  const aftercareField = templateFields.find((f) => f.key === "aftercare");
  const dateField = templateFields.find((f) => f.key === "treatment_date");

  // Products key: use template field key if available, otherwise a standard key
  const productsKey = productsField?.key ?? "_products";

  const getVal = (key: string, fallback: string = "") =>
    templateValues[key] ?? templateFields.find((f) => f.key === key)?.defaultValue ?? fallback;

  return (
    <CollapsibleCard
      icon={ClipboardListIcon}
      title="Procedure Details"
      subtitle="Treatment documentation and clinical notes"
    >
      <div className="space-y-5">
        {/* Chief Complaint */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Chief Complaint
          </label>
          <textarea
            value={chiefComplaint}
            onChange={(e) => onChiefComplaintChange(e.target.value)}
            disabled={disabled}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
            placeholder="Reason for visit, patient goals..."
          />
        </div>

        {/* Treatment Date */}
        {dateField && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {dateField.label}
              {dateField.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="date"
              value={getVal(dateField.key)}
              onChange={(e) => onTemplateChange(dateField.key, e.target.value)}
              disabled={disabled}
              className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
            />
          </div>
        )}

        {/* Areas Treated */}
        {areasField ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {areasField.label}
              {areasField.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <AreaPicker
              options={areasField.options ?? []}
              value={getVal(areasField.key) ? parseJson(getVal(areasField.key), []) : []}
              onChange={(v) => onTemplateChange(areasField.key, JSON.stringify(v))}
              disabled={disabled}
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Areas Treated
            </label>
            <input
              type="text"
              value={chiefComplaint}
              onChange={(e) => onChiefComplaintChange(e.target.value)}
              disabled={disabled}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
              placeholder="e.g. Forehead, Glabella, Full face"
            />
          </div>
        )}

        {/* Products Used — always visible */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            {productsField?.label ?? "Products Used"}
          </label>
          <ProductRows
            value={getVal(productsKey) ? parseJson(getVal(productsKey), []) : []}
            onChange={(v) => onTemplateChange(productsKey, JSON.stringify(v))}
            disabled={disabled}
          />
        </div>

        {/* Treatment Checklist */}
        {checklistField && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {checklistField.label}
            </label>
            <ChecklistField
              options={checklistField.options ?? []}
              value={getVal(checklistField.key) ? parseJson(getVal(checklistField.key), []) : []}
              onChange={(v) => onTemplateChange(checklistField.key, JSON.stringify(v))}
              disabled={disabled}
            />
          </div>
        )}

        {/* Provider Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Provider Notes
          </label>
          <textarea
            value={additionalNotes}
            onChange={(e) => onAdditionalNotesChange(e.target.value)}
            disabled={disabled}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
            placeholder="Additional observations or notes..."
          />
        </div>

        {/* Aftercare Instructions */}
        {aftercareField && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {aftercareField.label}
            </label>
            <textarea
              value={getVal(aftercareField.key)}
              onChange={(e) => onTemplateChange(aftercareField.key, e.target.value)}
              disabled={disabled}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
              placeholder="Post-treatment care instructions..."
            />
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}
