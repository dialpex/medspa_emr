"use client";

import { useState } from "react";

interface ConsentTemplate {
  id: string;
  name: string;
}

interface AftercareConsentProps {
  consentTemplates: ConsentTemplate[];
}

export function AftercareConsent({ consentTemplates }: AftercareConsentProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (consentTemplates.length === 0) {
    return (
      <p className="text-sm text-gray-400">No consent templates configured for this clinic.</p>
    );
  }

  return (
    <div className="space-y-2">
      {consentTemplates.map((template) => (
        <label
          key={template.id}
          className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
        >
          <input
            type="checkbox"
            checked={selected.has(template.id)}
            onChange={() => toggle(template.id)}
            className="size-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <span className="text-sm text-gray-700">{template.name}</span>
        </label>
      ))}
    </div>
  );
}
