"use client";

import type { EstheticsData } from "@/lib/templates/schemas";

interface EstheticsFieldsProps {
  data: EstheticsData;
  onChange: (data: EstheticsData) => void;
  disabled: boolean;
}

export function EstheticsFields({ data, onChange, disabled }: EstheticsFieldsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Areas Treated</label>
        <input
          type="text"
          value={data.areasTreated}
          onChange={(e) => onChange({ ...data, areasTreated: e.target.value })}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
          placeholder="e.g. Full face, Neck"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Products Used</label>
        <input
          type="text"
          value={data.productsUsed}
          onChange={(e) => onChange({ ...data, productsUsed: e.target.value })}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
          placeholder="e.g. Glycolic acid 30%, Hyaluronic serum"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Skin Response</label>
        <textarea
          value={data.skinResponse}
          onChange={(e) => onChange({ ...data, skinResponse: e.target.value })}
          disabled={disabled}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
          placeholder="Observed skin response during/after treatment..."
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Outcome</label>
        <textarea
          value={data.outcome}
          onChange={(e) => onChange({ ...data, outcome: e.target.value })}
          disabled={disabled}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
          placeholder="Treatment outcome..."
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Aftercare</label>
        <textarea
          value={data.aftercare}
          onChange={(e) => onChange({ ...data, aftercare: e.target.value })}
          disabled={disabled}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
          placeholder="Aftercare instructions..."
        />
      </div>
    </div>
  );
}
