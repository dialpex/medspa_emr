"use client";

import { useState } from "react";
import type { TemplateFieldConfig } from "@/lib/types/charts";

interface ChartFormFieldsProps {
  fields: TemplateFieldConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}

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
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange(
                selected ? value.filter((v) => v !== opt) : [...value, opt]
              )
            }
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              selected
                ? "bg-purple-100 border-purple-300 text-purple-700"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {opt}
          </button>
        );
      })}
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
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input
            type="text"
            value={row.lot}
            onChange={(e) => updateRow(i, "lot", e.target.value)}
            placeholder="Lot #"
            disabled={disabled}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input
            type="text"
            value={row.expiration}
            onChange={(e) => updateRow(i, "expiration", e.target.value)}
            placeholder="Expiration"
            disabled={disabled}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <div className="flex gap-1">
            <input
              type="text"
              value={row.quantity}
              onChange={(e) => updateRow(i, "quantity", e.target.value)}
              placeholder="Qty/Units"
              disabled={disabled}
              className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="px-2 text-red-400 hover:text-red-600"
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={addRow}
          className="text-sm text-purple-600 hover:text-purple-700"
        >
          + Add Product
        </button>
      )}
    </div>
  );
}

export function ChartFormFields({
  fields,
  values,
  onChange,
  disabled,
}: ChartFormFieldsProps) {
  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const val = values[field.key] ?? field.defaultValue ?? "";

        return (
          <div key={field.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {field.type === "text" && (
              <input
                type="text"
                value={val}
                onChange={(e) => onChange(field.key, e.target.value)}
                disabled={disabled}
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
              />
            )}

            {field.type === "textarea" && (
              <textarea
                value={val}
                onChange={(e) => onChange(field.key, e.target.value)}
                disabled={disabled}
                placeholder={field.placeholder}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
              />
            )}

            {field.type === "number" && (
              <input
                type="number"
                value={val}
                onChange={(e) => onChange(field.key, e.target.value)}
                disabled={disabled}
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
              />
            )}

            {field.type === "select" && (
              <select
                value={val}
                onChange={(e) => onChange(field.key, e.target.value)}
                disabled={disabled}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
              >
                <option value="">Select...</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {field.type === "multiselect" && (
              <AreaPicker
                options={field.options ?? []}
                value={val ? JSON.parse(val) : []}
                onChange={(v) => onChange(field.key, JSON.stringify(v))}
                disabled={disabled}
              />
            )}

            {field.type === "json-areas" && (
              <AreaPicker
                options={field.options ?? []}
                value={val ? (typeof val === "string" ? (() => { try { return JSON.parse(val); } catch { return []; } })() : []) : []}
                onChange={(v) => onChange(field.key, JSON.stringify(v))}
                disabled={disabled}
              />
            )}

            {field.type === "json-products" && (
              <ProductRows
                value={val ? (() => { try { return JSON.parse(val); } catch { return []; } })() : []}
                onChange={(v) => onChange(field.key, JSON.stringify(v))}
                disabled={disabled}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
