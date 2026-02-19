"use client";

import type { LaserData } from "@/lib/templates/schemas";

interface LaserFieldsProps {
  data: LaserData;
  onChange: (data: LaserData) => void;
  disabled: boolean;
}

export function LaserFields({ data, onChange, disabled }: LaserFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Device Name */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Device Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={data.deviceName}
          onChange={(e) => onChange({ ...data, deviceName: e.target.value })}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
          placeholder="e.g. Candela GentleMax Pro"
        />
      </div>

      {/* Areas Treated */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Areas Treated</label>
        <input
          type="text"
          value={data.areasTreated.join(", ")}
          onChange={(e) => onChange({ ...data, areasTreated: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
          placeholder="Comma-separated, e.g. Face, Neck, Chest"
        />
      </div>

      {/* Parameters */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Parameters</label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Energy <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={data.parameters.energy}
              onChange={(e) => onChange({ ...data, parameters: { ...data.parameters, energy: e.target.value } })}
              disabled={disabled}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
              placeholder="e.g. 30 J/cm²"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Pulse Duration</label>
            <input
              type="text"
              value={data.parameters.pulseDuration ?? ""}
              onChange={(e) => onChange({ ...data, parameters: { ...data.parameters, pulseDuration: e.target.value || undefined } })}
              disabled={disabled}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
              placeholder="e.g. 10ms"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Passes <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={data.parameters.passes || ""}
              onChange={(e) => onChange({ ...data, parameters: { ...data.parameters, passes: parseInt(e.target.value) || 0 } })}
              disabled={disabled}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
              placeholder="# of passes"
              min={0}
            />
          </div>
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
