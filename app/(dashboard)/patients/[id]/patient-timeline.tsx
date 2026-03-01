"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { PatientTimeline as TimelineData } from "@/lib/actions/patients";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString();
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

type SectionProps = {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

function CollapsibleSection({ title, count, children, defaultOpen = true }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-gray-50 flex justify-between items-center hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium">
          {title} <span className="text-gray-500">({count})</span>
        </span>
        <span className="text-gray-400">{isOpen ? "▼" : "▶"}</span>
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Scheduled: "bg-blue-100 text-blue-700",
    Confirmed: "bg-green-100 text-green-700",
    CheckedIn: "bg-yellow-100 text-yellow-700",
    InProgress: "bg-purple-100 text-purple-700",
    Completed: "bg-gray-100 text-gray-700",
    NoShow: "bg-red-100 text-red-700",
    Cancelled: "bg-red-100 text-red-700",
    Draft: "bg-yellow-100 text-yellow-700",
    NeedsSignOff: "bg-orange-100 text-orange-700",
    MDSigned: "bg-green-100 text-green-700",
    Sent: "bg-blue-100 text-blue-700",
    PartiallyPaid: "bg-yellow-100 text-yellow-700",
    Paid: "bg-green-100 text-green-700",
    Void: "bg-gray-100 text-gray-700",
    Refunded: "bg-red-100 text-red-700",
  };

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${colors[status] || "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

// --- Photo Lightbox ---

function PhotoLightbox({
  photo,
  photos,
  onClose,
  onNavigate,
}: {
  photo: TimelineData["photos"][number];
  photos: TimelineData["photos"];
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const currentIndex = photos.findIndex((p) => p.id === photo.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  // Lock body scroll while lightbox is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return createPortal(
    <div id="photo-lightbox" style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 99999,
      background: "rgba(0,0,0,1)",
    }} onClick={onClose}>
      {/* Close */}
      <button onClick={onClose} style={{
        position: "absolute", top: 16, right: 16, zIndex: 1,
        width: 40, height: 40,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "50%", background: "rgba(0,0,0,0.5)",
        color: "white", border: "none", cursor: "pointer", fontSize: 24,
      }}>&times;</button>

      {/* Prev */}
      {hasPrev && <button onClick={(e) => { e.stopPropagation(); onNavigate(photos[currentIndex - 1].id); }} style={{
        position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", zIndex: 1,
        width: 40, height: 40,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "50%", background: "rgba(0,0,0,0.5)",
        color: "white", border: "none", cursor: "pointer", fontSize: 24,
      }}>&#8249;</button>}

      {/* Next */}
      {hasNext && <button onClick={(e) => { e.stopPropagation(); onNavigate(photos[currentIndex + 1].id); }} style={{
        position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", zIndex: 1,
        width: 40, height: 40,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "50%", background: "rgba(0,0,0,0.5)",
        color: "white", border: "none", cursor: "pointer", fontSize: 24,
      }}>&#8250;</button>}

      {/* Image — absolutely centered using inset:0 + margin:auto */}
      <img
        src={`/api/photos/${photo.id}`}
        alt={photo.caption || photo.category || "Patient photo"}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          inset: 0,
          margin: "auto",
          maxWidth: "85vw",
          maxHeight: "75vh",
          objectFit: "contain",
          borderRadius: 8,
        }}
      />

      {/* Info bar — anchored to bottom center */}
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", bottom: 24, left: 0, right: 0,
        textAlign: "center", color: "white",
      }}>
        <div style={{ fontSize: 14 }}>
          {photo.category && (
            <span style={{ padding: "2px 8px", fontSize: 12, borderRadius: 9999, background: "rgba(255,255,255,0.2)", marginRight: 8 }}>{photo.category}</span>
          )}
          {photo.caption && <span style={{ opacity: 0.8 }}>{photo.caption}</span>}
        </div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
          {formatDate(photo.createdAt)} • {photo.takenBy.name} • {currentIndex + 1} of {photos.length}
        </div>
      </div>
    </div>,
    document.body
  );
}

// --- HTML Sanitizer for imported form content ---

const ALLOWED_TAGS = new Set([
  "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u",
  "ul", "ol", "li",
  "a", "span", "div",
  "blockquote", "hr",
]);

/**
 * Strip unsafe HTML tags (scripts, iframes, event handlers) but keep
 * formatting tags so imported consent/form content renders cleanly.
 */
function sanitizeHtml(html: string): string {
  // Remove script/style/iframe tags and their content
  let clean = html.replace(/<(script|style|iframe|object|embed|form|input|textarea|button)[^>]*>[\s\S]*?<\/\1>/gi, "");
  // Remove self-closing versions
  clean = clean.replace(/<(script|style|iframe|object|embed|form|input|textarea|button)[^>]*\/?>/gi, "");
  // Remove event handlers (on*)
  clean = clean.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Remove javascript: URLs
  clean = clean.replace(/href\s*=\s*"javascript:[^"]*"/gi, 'href="#"');
  clean = clean.replace(/href\s*=\s*'javascript:[^']*'/gi, "href='#'");
  // Strip tags not in allowlist
  clean = clean.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
    return ALLOWED_TAGS.has(tag.toLowerCase()) ? match : "";
  });
  // Replace &nbsp; with regular spaces
  clean = clean.replace(/&nbsp;/g, " ");
  return clean;
}

/**
 * Check if a string contains HTML tags.
 */
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
  consent: TimelineData["consents"][number];
  onClose: () => void;
}) {
  let snapshot: ConsentSnapshotData | null = null;
  try {
    if (consent.templateSnapshot) {
      snapshot = JSON.parse(consent.templateSnapshot);
    }
  } catch {
    // Invalid JSON — ignore
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

                        // Rich HTML content block (e.g., full consent text from Boulevard TextV2 components)
                        if (labelHasHtml) {
                          return (
                            <div
                              key={i}
                              className="prose prose-sm max-w-none text-gray-700 [&>h1]:text-base [&>h1]:font-bold [&>h1]:mt-4 [&>h1]:mb-2 [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1 [&>p]:my-1.5 [&>ul]:my-1 [&>ol]:my-1 [&>li]:my-0.5"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(field.label) }}
                            />
                          );
                        }

                        // Value contains HTML
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

                        // Skip empty fields — they're auto-populated by the source platform
                        // (e.g., First name, Last name, Today's Date are filled from the client record)
                        if (!displayValue && !field.label) return null;
                        if (!displayValue) return null;

                        // Plain text label: value pair
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

// --- Main Timeline ---

export function PatientTimeline({ timeline }: { timeline: TimelineData }) {
  const [selectedConsent, setSelectedConsent] = useState<TimelineData["consents"][number] | null>(null);
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);

  const lightboxPhoto = lightboxPhotoId ? timeline.photos.find((p) => p.id === lightboxPhotoId) : null;

  return (
    <div className="space-y-4">
      {/* Appointments */}
      <CollapsibleSection title="Appointments" count={timeline.appointments.length}>
        {timeline.appointments.length === 0 ? (
          <p className="text-gray-500 text-sm">No appointments</p>
        ) : (
          <div className="space-y-3">
            {timeline.appointments.map((apt) => (
              <div
                key={apt.id}
                className="flex justify-between items-start p-3 bg-gray-50 rounded-md"
              >
                <div>
                  <div className="font-medium">
                    {apt.service?.name || "Appointment"}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatDateTime(apt.startTime)} • {apt.provider.name}
                  </div>
                </div>
                <StatusBadge status={apt.status} />
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Charts */}
      <CollapsibleSection title="Charts" count={timeline.charts.length}>
        {timeline.charts.length === 0 ? (
          <p className="text-gray-500 text-sm">No charts</p>
        ) : (
          <div className="space-y-3">
            {timeline.charts.map((chart) => (
              <Link
                key={chart.id}
                href={`/charts/${chart.id}`}
                className="flex justify-between items-start p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors cursor-pointer block"
              >
                <div>
                  <div className="font-medium">
                    {chart.chiefComplaint || "Treatment Note"}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatDate(chart.createdAt)} • {chart.createdBy?.name}
                    {chart.signedBy && (
                      <span className="ml-2">
                        • Signed by {chart.signedBy.name}
                      </span>
                    )}
                  </div>
                </div>
                <StatusBadge status={chart.status} />
              </Link>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Photos */}
      <CollapsibleSection title="Photos" count={timeline.photos.length}>
        {timeline.photos.length === 0 ? (
          <p className="text-gray-500 text-sm">No photos</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {timeline.photos.map((photo) => (
              <div
                key={photo.id}
                className="cursor-pointer group"
                onClick={() => setLightboxPhotoId(photo.id)}
              >
                <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-200 group-hover:ring-purple-300 transition-all">
                  <img
                    src={`/api/photos/${photo.id}`}
                    alt={photo.caption || photo.category || "Patient photo"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                  {photo.category && (
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-black/60 text-white">
                      {photo.category}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-gray-500 truncate">
                  {formatDate(photo.createdAt)} • {photo.takenBy.name}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Consents */}
      <CollapsibleSection title="Consents" count={timeline.consents.length}>
        {timeline.consents.length === 0 ? (
          <p className="text-gray-500 text-sm">No consents</p>
        ) : (
          <div className="space-y-3">
            {timeline.consents.map((consent) => (
              <div
                key={consent.id}
                className="flex justify-between items-start p-3 bg-gray-50 rounded-md cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setSelectedConsent(consent)}
              >
                <div>
                  <div className="font-medium">{consent.template.name}</div>
                  <div className="text-sm text-gray-600">
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
        )}
      </CollapsibleSection>

      {/* Documents */}
      <CollapsibleSection title="Documents" count={timeline.documents.length}>
        {timeline.documents.length === 0 ? (
          <p className="text-gray-500 text-sm">No documents</p>
        ) : (
          <div className="space-y-3">
            {timeline.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex justify-between items-start p-3 bg-gray-50 rounded-md"
              >
                <div>
                  <div className="font-medium">{doc.filename}</div>
                  <div className="text-sm text-gray-600">
                    {doc.category && <span className="capitalize">{doc.category} • </span>}
                    {formatDate(doc.createdAt)} • {doc.uploadedBy.name}
                  </div>
                  {doc.notes && (
                    <div className="text-xs text-gray-500 mt-1">{doc.notes}</div>
                  )}
                </div>
                <a
                  href={`/api/documents/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  View
                </a>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Invoices */}
      <CollapsibleSection title="Invoices" count={timeline.invoices.length}>
        {timeline.invoices.length === 0 ? (
          <p className="text-gray-500 text-sm">No invoices</p>
        ) : (
          <div className="space-y-3">
            {timeline.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex justify-between items-start p-3 bg-gray-50 rounded-md"
              >
                <div>
                  <div className="font-medium">
                    {invoice.invoiceNumber} • {formatCurrency(invoice.total)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatDate(invoice.createdAt)}
                    {invoice.paidAt && ` • Paid ${formatDate(invoice.paidAt)}`}
                  </div>
                </div>
                <StatusBadge status={invoice.status} />
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Consent Preview Modal */}
      {selectedConsent && (
        <ConsentPreviewModal
          consent={selectedConsent}
          onClose={() => setSelectedConsent(null)}
        />
      )}

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <PhotoLightbox
          photo={lightboxPhoto}
          photos={timeline.photos}
          onClose={() => setLightboxPhotoId(null)}
          onNavigate={(id) => setLightboxPhotoId(id)}
        />
      )}
    </div>
  );
}
