"use client";

import { useState, useRef, useCallback } from "react";
import { CameraIcon, XIcon } from "lucide-react";
import type { TemplateFieldConfig } from "@/lib/types/charts";

interface ChartFormFieldsProps {
  fields: TemplateFieldConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
  chartId: string;
  patientId: string;
}

function parseJson<T>(val: string, fallback: T): T {
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
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
              onChange(selected ? value.filter((v) => v !== opt) : [...value, opt])
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

function SignatureField({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    drawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }, [disabled]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  }, [disabled]);

  const endDraw = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      onChange(canvas.toDataURL("image/png"));
    }
  }, [onChange]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    onChange("");
  }, [onChange]);

  return (
    <div>
      <div className="relative border border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={500}
          height={120}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          className={`w-full h-[120px] ${disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair"}`}
        />
        {!value && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm text-gray-400">Sign here</span>
          </div>
        )}
      </div>
      {!disabled && value && (
        <button type="button" onClick={clear} className="mt-1 text-xs text-red-500 hover:text-red-700">
          Clear signature
        </button>
      )}
    </div>
  );
}

/** Viewer panel for a single photo — checkerboard bg, toolbar, upload/replace/remove */
function PhotoPanel({
  label,
  photoId,
  onUpload,
  onRemove,
  disabled,
  uploading,
}: {
  label: string;
  photoId: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  uploading?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          {label}
        </span>
        {!disabled && (
          <div className="flex items-center gap-1">
            {photoId && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
              >
                Replace
              </button>
            )}
            {photoId && (
              <button
                type="button"
                onClick={onRemove}
                className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>

      {/* Image area with checkerboard bg */}
      {photoId ? (
        <div
          className="relative flex items-center justify-center p-4"
          style={{
            backgroundColor: "#f9fafb",
            backgroundImage:
              "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/photos/${photoId}`}
            alt={label}
            className="max-w-full max-h-[320px] rounded shadow-sm object-contain"
          />
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 py-12 px-4 text-gray-400 hover:text-purple-500 hover:bg-purple-50/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "#f9fafb",
            backgroundImage:
              "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
          }}
        >
          {uploading ? (
            <>
              <div className="size-8 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
              <span className="text-xs font-medium">Uploading...</span>
            </>
          ) : (
            <>
              <CameraIcon className="size-8" />
              <span className="text-xs font-medium">Click to add photo</span>
              <span className="text-[10px] text-gray-400">JPEG or PNG, max 10 MB</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function PhotoPairField({
  fieldKey,
  photoLabels,
  value,
  onChange,
  disabled,
  chartId,
  patientId,
}: {
  fieldKey: string;
  photoLabels: [string, string];
  value: { before?: string; after?: string };
  onChange: (v: { before?: string; after?: string }) => void;
  disabled?: boolean;
  chartId: string;
  patientId: string;
}) {
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);

  const uploadPhoto = async (file: File, slot: "before" | "after") => {
    const setUploading = slot === "before" ? setUploadingBefore : setUploadingAfter;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("patientId", patientId);
    formData.append("chartId", chartId);
    formData.append("category", `${fieldKey}_${slot}`);

    const res = await fetch("/api/photos/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success && data.photo) {
      onChange({ ...value, [slot]: data.photo.id });
    }
    setUploading(false);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <PhotoPanel
        label={photoLabels[0]}
        photoId={value.before ?? ""}
        onUpload={(f) => uploadPhoto(f, "before")}
        onRemove={() => onChange({ ...value, before: undefined })}
        disabled={disabled}
        uploading={uploadingBefore}
      />
      <PhotoPanel
        label={photoLabels[1]}
        photoId={value.after ?? ""}
        onUpload={(f) => uploadPhoto(f, "after")}
        onRemove={() => onChange({ ...value, after: undefined })}
        disabled={disabled}
        uploading={uploadingAfter}
      />
    </div>
  );
}

function PhotoSingleField({
  fieldKey,
  value,
  onChange,
  disabled,
  chartId,
  patientId,
}: {
  fieldKey: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  chartId: string;
  patientId: string;
}) {
  const [uploading, setUploading] = useState(false);

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("patientId", patientId);
    formData.append("chartId", chartId);
    formData.append("category", fieldKey);

    const res = await fetch("/api/photos/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success && data.photo) {
      onChange(data.photo.id);
    }
    setUploading(false);
  };

  return (
    <div className="max-w-md">
      <PhotoPanel
        label={fieldKey.replace(/_/g, " ")}
        photoId={value}
        onUpload={uploadPhoto}
        onRemove={() => onChange("")}
        disabled={disabled}
        uploading={uploading}
      />
    </div>
  );
}

// --- Main Component ---

export function ChartFormFields({
  fields,
  values,
  onChange,
  disabled,
  chartId,
  patientId,
}: ChartFormFieldsProps) {
  return (
    <div className="space-y-5 min-w-0 overflow-hidden">
      {fields.map((field) => {
        const val = values[field.key] ?? field.defaultValue ?? "";

        // Heading — section divider, no input
        if (field.type === "heading") {
          return (
            <div key={field.key} className="pt-4 pb-1 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">{field.label}</h3>
            </div>
          );
        }

        return (
          <div key={field.key} className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {(field.type === "text" || field.type === "first-name" || field.type === "last-name") && (
              <input
                type="text"
                value={val}
                onChange={(e) => onChange(field.key, e.target.value)}
                disabled={disabled}
                placeholder={field.placeholder || (field.type === "first-name" ? "First Name" : field.type === "last-name" ? "Last Name" : undefined)}
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50 break-words"
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

            {field.type === "date" && (
              <input
                type="date"
                value={val}
                onChange={(e) => onChange(field.key, e.target.value)}
                disabled={disabled}
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
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {field.type === "multiselect" && (
              <AreaPicker
                options={field.options ?? []}
                value={val ? parseJson(val, []) : []}
                onChange={(v) => onChange(field.key, JSON.stringify(v))}
                disabled={disabled}
              />
            )}

            {field.type === "json-areas" && (
              <AreaPicker
                options={field.options ?? []}
                value={val ? parseJson(val, []) : []}
                onChange={(v) => onChange(field.key, JSON.stringify(v))}
                disabled={disabled}
              />
            )}

            {field.type === "json-products" && (
              <ProductRows
                value={val ? parseJson(val, []) : []}
                onChange={(v) => onChange(field.key, JSON.stringify(v))}
                disabled={disabled}
              />
            )}

            {field.type === "checklist" && (
              <ChecklistField
                options={field.options ?? []}
                value={val ? parseJson(val, []) : []}
                onChange={(v) => onChange(field.key, JSON.stringify(v))}
                disabled={disabled}
              />
            )}

            {field.type === "signature" && (
              <SignatureField
                value={val}
                onChange={(v) => onChange(field.key, v)}
                disabled={disabled}
                label={field.label}
              />
            )}

            {field.type === "photo-pair" && (
              <PhotoPairField
                fieldKey={field.key}
                photoLabels={field.photoLabels ?? ["Before", "After"]}
                value={val ? parseJson(val, {}) : {}}
                onChange={(v) => onChange(field.key, JSON.stringify(v))}
                disabled={disabled}
                chartId={chartId}
                patientId={patientId}
              />
            )}

            {field.type === "photo-single" && (
              <PhotoSingleField
                fieldKey={field.key}
                value={val}
                onChange={(v) => onChange(field.key, v)}
                disabled={disabled}
                chartId={chartId}
                patientId={patientId}
              />
            )}

            {field.type === "logo" && (
              <PhotoSingleField
                fieldKey={field.key}
                value={val}
                onChange={(v) => onChange(field.key, v)}
                disabled={disabled}
                chartId={chartId}
                patientId={patientId}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
