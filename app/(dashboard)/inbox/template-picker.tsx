"use client";

import { useState, useRef, useEffect } from "react";
import { FileText, X } from "lucide-react";
import type { MessageTemplate, MessagePurpose } from "@prisma/client";

const PURPOSE_LABELS: Record<string, string> = {
  AppointmentConfirmation: "Confirmation",
  Reminder: "Reminder",
  Arrival: "Arrival",
  FollowUp: "Follow Up",
  Generic: "Generic",
};

const PURPOSE_COLORS: Record<string, string> = {
  AppointmentConfirmation: "bg-green-100 text-green-700",
  Reminder: "bg-blue-100 text-blue-700",
  Arrival: "bg-amber-100 text-amber-700",
  FollowUp: "bg-purple-100 text-purple-700",
  Generic: "bg-gray-100 text-gray-700",
};

export function TemplatePicker({
  templates,
  patientFirstName,
  patientLastName,
  onSelect,
}: {
  templates: MessageTemplate[];
  patientFirstName: string;
  patientLastName: string;
  onSelect: (body: string, purpose: MessagePurpose) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const substituteVariables = (text: string): string => {
    return text
      .replace(/\{\{firstName\}\}/g, patientFirstName)
      .replace(/\{\{lastName\}\}/g, patientLastName);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        title="Insert template"
      >
        <FileText className="size-4" />
        Templates
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg z-50">
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-900">
              Message Templates
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {templates.length === 0 ? (
              <p className="p-3 text-sm text-gray-400 text-center">
                No templates available
              </p>
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    onSelect(
                      substituteVariables(template.bodyText),
                      template.purpose
                    );
                    setOpen(false);
                  }}
                  className="w-full text-left rounded-md p-2.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {template.key
                        .split("-")
                        .map(
                          (w) => w.charAt(0).toUpperCase() + w.slice(1)
                        )
                        .join(" ")}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        PURPOSE_COLORS[template.purpose] ||
                        PURPOSE_COLORS.Generic
                      }`}
                    >
                      {PURPOSE_LABELS[template.purpose] || template.purpose}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {substituteVariables(template.bodyText)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
