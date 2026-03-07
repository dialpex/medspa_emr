"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import { type TemplateFieldConfig } from "@/lib/types/charts";
import { ChartFormFields } from "@/app/(dashboard)/charts/[id]/edit/chart-form-fields";

interface TemplatePreviewModalProps {
  name: string;
  fields: TemplateFieldConfig[];
  onClose: () => void;
  clinicLogoUrl?: string;
}

export function TemplatePreviewModal({ name, fields, onClose, clinicLogoUrl }: TemplatePreviewModalProps) {
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
            <p className="text-sm text-gray-400 text-center py-8">No fields to preview.</p>
          ) : (
            <ChartFormFields
              fields={fields}
              values={formValues}
              onChange={(k, v) => setFormValues(prev => ({ ...prev, [k]: v }))}
              chartId=""
              patientId=""
              clinicLogoUrl={clinicLogoUrl}
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
