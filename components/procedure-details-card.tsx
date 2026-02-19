"use client";

import { ClipboardListIcon } from "lucide-react";
import { CollapsibleCard } from "@/components/ui/collapsible-card";

interface ProcedureDetailsCardProps {
  chiefComplaint: string;
  onChiefComplaintChange: (value: string) => void;
  areasTreated: string;
  onAreasTreatedChange: (value: string) => void;
  disabled?: boolean;
}

export function ProcedureDetailsCard({
  chiefComplaint,
  onChiefComplaintChange,
  areasTreated,
  onAreasTreatedChange,
  disabled,
}: ProcedureDetailsCardProps) {
  return (
    <CollapsibleCard
      icon={ClipboardListIcon}
      title="Procedure Details"
      subtitle="Chief complaint, goals, and area assessment"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Chief Complaint
          </label>
          <textarea
            value={chiefComplaint}
            onChange={(e) => onChiefComplaintChange(e.target.value)}
            disabled={disabled}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
            placeholder="Reason for visit, patient goals..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Areas Treated
          </label>
          <input
            type="text"
            value={areasTreated}
            onChange={(e) => onAreasTreatedChange(e.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
            placeholder="e.g. Forehead, Glabella, Full face"
          />
        </div>
      </div>
    </CollapsibleCard>
  );
}
