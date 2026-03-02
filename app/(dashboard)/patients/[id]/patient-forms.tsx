"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardList } from "lucide-react";
import type { PatientTimeline } from "@/lib/actions/patients";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString();
}

// --- HTML Sanitizer for imported form content ---

const ALLOWED_TAGS = new Set([
  "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u",
  "ul", "ol", "li",
  "a", "span", "div",
  "blockquote", "hr",
]);

function sanitizeHtml(html: string): string {
  let clean = html.replace(/<(script|style|iframe|object|embed|form|input|textarea|button)[^>]*>[\s\S]*?<\/\1>/gi, "");
  clean = clean.replace(/<(script|style|iframe|object|embed|form|input|textarea|button)[^>]*\/?>/gi, "");
  clean = clean.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  clean = clean.replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"');
  clean = clean.replace(/href\s*=\s*'javascript:[^']*'/gi, "href='#'");
  clean = clean.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
    return ALLOWED_TAGS.has(tag.toLowerCase()) ? match : "";
  });
  clean = clean.replace(/&nbsp;/g, " ");
  return clean;
}

function containsHtml(str: string): boolean {
  return /<[a-zA-Z][^>]*>/.test(str);
}

// --- Consent Preview Modal ---

interface ConsentSnapshotData {
  importedFrom?: string;
  originalStatus?: string;
  submittedByName?: string;
  submittedByRole?: string;
  isInternal?: boolean;
  expirationDate?: string;
  sourceTemplateId?: string;
  formFields?: Array<{ label: string; value: string | null; selectedOptions?: string[] }>;
}

function ConsentPreviewModal({
  consent,
  onClose,
}: {
  consent: PatientTimeline["consents"][number];
  onClose: () => void;
}) {
  let snapshot: ConsentSnapshotData | null = null;
  try {
    if (consent.templateSnapshot) {
      snapshot = JSON.parse(consent.templateSnapshot);
    }
  } catch {
    // Invalid JSON
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold">{consent.template.name}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
              &times;
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  consent.signedAt
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {consent.signedAt ? "Signed" : "Pending"}
              </span>
              <span className="text-sm text-gray-600">
                {consent.signedAt
                  ? `Signed ${formatDateTime(consent.signedAt)}`
                  : `Created ${formatDate(consent.createdAt)}`}
              </span>
            </div>

            {snapshot && (
              <div className="border-t pt-3 space-y-2">
                {snapshot.importedFrom && (
                  <div className="text-sm">
                    <span className="text-gray-500">Imported from:</span>{" "}
                    <span className="font-medium">{snapshot.importedFrom}</span>
                  </div>
                )}
                {snapshot.originalStatus && (
                  <div className="text-sm">
                    <span className="text-gray-500">Original status:</span>{" "}
                    <span className="font-medium">{snapshot.originalStatus}</span>
                  </div>
                )}
                {snapshot.submittedByName && (
                  <div className="text-sm">
                    <span className="text-gray-500">Submitted by:</span>{" "}
                    <span className="font-medium">
                      {snapshot.submittedByName}
                      {snapshot.submittedByRole && ` (${snapshot.submittedByRole})`}
                    </span>
                  </div>
                )}
                {snapshot.isInternal !== undefined && (
                  <div className="text-sm">
                    <span className="text-gray-500">Type:</span>{" "}
                    <span className="font-medium">{snapshot.isInternal ? "Internal" : "Client-facing"}</span>
                  </div>
                )}
                {snapshot.expirationDate && (
                  <div className="text-sm">
                    <span className="text-gray-500">Expires:</span>{" "}
                    <span className="font-medium">{formatDate(new Date(snapshot.expirationDate))}</span>
                  </div>
                )}

                {snapshot.formFields && snapshot.formFields.length > 0 ? (
                  <div className="border-t pt-3 mt-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Form Responses</h4>
                    <div className="space-y-2">
                      {snapshot.formFields.map((field, i) => {
                        const labelHasHtml = containsHtml(field.label || "");
                        const displayValue = field.selectedOptions?.length
                          ? field.selectedOptions.join(", ")
                          : field.value || "";
                        const valueHasHtml = containsHtml(displayValue);

                        if (labelHasHtml) {
                          return (
                            <div
                              key={i}
                              className="prose prose-sm max-w-none text-gray-700 [&>h1]:text-base [&>h1]:font-bold [&>h1]:mt-4 [&>h1]:mb-2 [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1 [&>p]:my-1.5 [&>ul]:my-1 [&>ol]:my-1 [&>li]:my-0.5"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(field.label) }}
                            />
                          );
                        }

                        if (valueHasHtml) {
                          return (
                            <div key={i} className="text-sm">
                              {field.label && <span className="text-gray-500 font-medium block mb-1">{field.label}</span>}
                              <div
                                className="prose prose-sm max-w-none text-gray-700 [&>p]:my-1 [&>ul]:my-1 [&>li]:my-0"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayValue) }}
                              />
                            </div>
                          );
                        }

                        if (!displayValue && !field.label) return null;
                        if (!displayValue) return null;

                        return (
                          <div key={i} className="text-sm">
                            {field.label && <span className="text-gray-500">{field.label}:</span>}{" "}
                            <span className="font-medium">{displayValue}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-sm text-gray-400 italic">
                      Form content not available — the source platform does not expose field-level data for this form type.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// --- Main Component ---

export function PatientForms({
  consents,
}: {
  consents: PatientTimeline["consents"];
}) {
  const [selectedConsent, setSelectedConsent] = useState<PatientTimeline["consents"][number] | null>(null);

  if (consents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <ClipboardList className="size-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No forms or consents yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {consents.map((consent) => (
          <div
            key={consent.id}
            className="flex justify-between items-start p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => setSelectedConsent(consent)}
          >
            <div>
              <div className="font-medium text-sm">{consent.template.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {consent.signedAt
                  ? `Signed ${formatDateTime(consent.signedAt)}`
                  : `Created ${formatDate(consent.createdAt)} - Pending signature`}
              </div>
            </div>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                consent.signedAt
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {consent.signedAt ? "Signed" : "Pending"}
            </span>
          </div>
        ))}
      </div>

      {selectedConsent && (
        <ConsentPreviewModal
          consent={selectedConsent}
          onClose={() => setSelectedConsent(null)}
        />
      )}
    </>
  );
}
