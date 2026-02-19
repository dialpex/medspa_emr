"use client";

import { PlusIcon, XIcon } from "lucide-react";
import type { InjectableData } from "@/lib/templates/schemas";

interface InjectableFieldsProps {
  data: InjectableData;
  onChange: (data: InjectableData) => void;
  disabled: boolean;
}

export function InjectableFields({ data, onChange, disabled }: InjectableFieldsProps) {
  const areasSum = data.areas.reduce((sum, a) => sum + (a.units || 0), 0);
  const mismatch = data.totalUnits > 0 && areasSum > 0 && data.totalUnits !== areasSum;

  return (
    <div className="space-y-4">
      {/* Product Name */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Product Name</label>
        <input
          type="text"
          value={data.productName}
          onChange={(e) => onChange({ ...data, productName: e.target.value })}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
          placeholder="e.g. Botox, Dysport"
        />
      </div>

      {/* Areas */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Treatment Areas</label>
        <div className="space-y-2">
          {data.areas.map((area, i) => (
            <div key={`area-${i}`} className="flex items-center gap-2">
              <input
                type="text"
                value={area.areaLabel}
                onChange={(e) => {
                  const areas = [...data.areas];
                  areas[i] = { ...areas[i], areaLabel: e.target.value };
                  onChange({ ...data, areas });
                }}
                disabled={disabled}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                placeholder="Area name"
              />
              <input
                type="number"
                value={area.units || ""}
                onChange={(e) => {
                  const areas = [...data.areas];
                  areas[i] = { ...areas[i], units: parseInt(e.target.value) || 0 };
                  const newAreas = areas;
                  const newSum = newAreas.reduce((s, a) => s + (a.units || 0), 0);
                  onChange({ ...data, areas: newAreas, totalUnits: newSum });
                }}
                disabled={disabled}
                className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                placeholder="Units"
                min={0}
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => {
                    const areas = data.areas.filter((_, idx) => idx !== i);
                    const newSum = areas.reduce((s, a) => s + (a.units || 0), 0);
                    onChange({ ...data, areas, totalUnits: newSum });
                  }}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>
          ))}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange({ ...data, areas: [...data.areas, { areaLabel: "", units: 0 }] })}
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700"
            >
              <PlusIcon className="size-3.5" /> Add area
            </button>
          )}
        </div>
      </div>

      {/* Total Units */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Total Units</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={data.totalUnits || ""}
            onChange={(e) => onChange({ ...data, totalUnits: parseInt(e.target.value) || 0 })}
            disabled={disabled}
            className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
            min={0}
          />
          {areasSum > 0 && (
            <span className="text-xs text-gray-500">Areas sum: {areasSum}</span>
          )}
          {mismatch && (
            <span className="text-xs text-amber-600 font-medium">Mismatch</span>
          )}
        </div>
      </div>

      {/* Lot Entries */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Lot Entries <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {data.lotEntries.map((lot, i) => (
            <div key={`lot-${i}`} className="flex items-center gap-2">
              <input
                type="text"
                value={lot.lotNumber}
                onChange={(e) => {
                  const lotEntries = [...data.lotEntries];
                  lotEntries[i] = { ...lotEntries[i], lotNumber: e.target.value };
                  onChange({ ...data, lotEntries });
                }}
                disabled={disabled}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                placeholder="Lot number"
              />
              <input
                type="month"
                value={lot.expirationDate}
                onChange={(e) => {
                  const lotEntries = [...data.lotEntries];
                  lotEntries[i] = { ...lotEntries[i], expirationDate: e.target.value };
                  onChange({ ...data, lotEntries });
                }}
                disabled={disabled}
                className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => {
                    const lotEntries = data.lotEntries.filter((_, idx) => idx !== i);
                    onChange({ ...data, lotEntries });
                  }}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>
          ))}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange({ ...data, lotEntries: [...data.lotEntries, { lotNumber: "", expirationDate: "" }] })}
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700"
            >
              <PlusIcon className="size-3.5" /> Add lot entry
            </button>
          )}
        </div>
      </div>

      {/* Outcome */}
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

      {/* Follow-Up Plan */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Follow-Up Plan</label>
        <textarea
          value={data.followUpPlan}
          onChange={(e) => onChange({ ...data, followUpPlan: e.target.value })}
          disabled={disabled}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
          placeholder="Follow-up plan..."
        />
      </div>

      {/* Aftercare */}
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
