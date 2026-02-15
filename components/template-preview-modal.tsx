"use client";

import { XIcon } from "lucide-react";
import type { TemplateFieldConfig } from "@/lib/types/charts";

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

interface TemplatePreviewModalProps {
  name: string;
  fields: TemplateFieldConfig[];
  onClose: () => void;
}

export function TemplatePreviewModal({ name, fields, onClose }: TemplatePreviewModalProps) {
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
            <p className="text-sm text-gray-400 text-center py-8">No fields to preview.</p>
          ) : (
            <div className="space-y-5">
              {fields.map((field) => (
                <PreviewField key={field.key} field={field} />
              ))}
            </div>
          )}
        </div>
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
