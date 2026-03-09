"use client";

import { ShieldCheckIcon, ClockIcon, UserIcon, ClipboardCheckIcon } from "lucide-react";
import { PhotoAnnotationRenderer } from "@/components/photo-annotation-renderer";
import { getEffectiveStatus } from "@/lib/encounter-utils";
import type { TemplateFieldConfig } from "@/lib/types/charts";

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  NeedsSignOff: "bg-amber-50 text-amber-700",
  MDSigned: "bg-green-50 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  Draft: "Draft",
  NeedsSignOff: "Needs Sign-off",
  MDSigned: "Signed",
};

type ChartData = {
  id: string;
  status: string;
  chiefComplaint: string | null;
  areasTreated: string | null;
  productsUsed: string | null;
  dosageUnits: string | null;
  aftercareNotes: string | null;
  additionalNotes: string | null;
  providerSignedAt: Date | null;
  providerSignedBy: { name: string } | null;
  signedByName: string | null;
  signedAt: Date | null;
  recordHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  patient: { firstName: string; lastName: string; allergies: string | null } | null;
  createdBy: { name: string } | null;
  signedBy: { name: string } | null;
  encounter: { id: string; status: string; provider: { name: string } } | null;
  template: { name: string; fieldsConfig: string } | null;
  photos: Array<{
    id: string;
    filename: string;
    category: string | null;
    caption: string | null;
    annotations: string | null;
  }>;
  appointment: { startTime: Date; service: { name: string } | null } | null;
};

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-500 uppercase">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

function JsonDisplay({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return null;
      // Check if it's array of strings or objects
      if (typeof parsed[0] === "string") {
        return (
          <div>
            <dt className="text-xs font-semibold text-gray-500 uppercase">{label}</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {parsed.map((item: string) => (
                <span key={item} className="px-2 py-0.5 text-sm bg-purple-50 text-purple-700 rounded-full">
                  {item}
                </span>
              ))}
            </dd>
          </div>
        );
      }
      // Objects (products)
      return (
        <div>
          <dt className="text-xs font-semibold text-gray-500 uppercase">{label}</dt>
          <dd className="mt-1 space-y-1">
            {parsed.map((item: Record<string, string | number>, idx: number) => (
              <div key={Object.values(item).join("-") || idx} className="text-sm text-gray-900 bg-gray-50 rounded p-2">
                {Object.entries(item).map(([k, v]) => (
                  <span key={k} className="mr-3">
                    <span className="text-gray-500">{k}:</span> {String(v)}
                  </span>
                ))}
              </div>
            ))}
          </dd>
        </div>
      );
    }
  } catch {}
  return <DetailRow label={label} value={value} />;
}

export function ChartDetail({ chart }: { chart: ChartData }) {
  const templateFields: TemplateFieldConfig[] = chart.template
    ? JSON.parse(chart.template.fieldsConfig)
    : [];

  const templateValues: Record<string, string> = chart.template && chart.additionalNotes
    ? (() => { try { return JSON.parse(chart.additionalNotes); } catch { return {}; } })()
    : {};

  const effectiveStatus = getEffectiveStatus(chart);
  const providerName = chart.encounter?.provider.name ?? chart.createdBy?.name ?? "Unknown";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Chart: {chart.patient?.firstName} {chart.patient?.lastName}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[effectiveStatus]}`}>
              {STATUS_LABELS[effectiveStatus] ?? effectiveStatus}
            </span>
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <UserIcon className="size-3.5" />
              {providerName}
            </span>
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <ClockIcon className="size-3.5" />
              {new Date(chart.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            {chart.template && (
              <span className="text-sm text-purple-600">
                {chart.template.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Provider signature block — shown when awaiting MD review */}
      {effectiveStatus === "NeedsSignOff" && chart.providerSignedAt && chart.providerSignedBy && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
          <ClipboardCheckIcon className="size-6 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-800">
              Signed by {chart.providerSignedBy.name}
            </p>
            <p className="text-xs text-blue-600">
              {new Date(chart.providerSignedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {" · Awaiting MD Review"}
            </p>
          </div>
        </div>
      )}

      {/* MD Signature block */}
      {effectiveStatus === "MDSigned" && chart.signedByName && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <ShieldCheckIcon className="size-6 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-800">
              {chart.providerSignedBy
                ? `Co-signed by ${chart.signedByName}`
                : `Signed by ${chart.signedByName}`}
            </p>
            <p className="text-xs text-green-600">
              {chart.signedAt && new Date(chart.signedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {chart.recordHash && ` · Hash: ${chart.recordHash.substring(0, 20)}...`}
            </p>
            {chart.providerSignedBy && chart.providerSignedAt && (
              <p className="text-xs text-green-600 mt-0.5">
                Provider: {chart.providerSignedBy.name} on{" "}
                {new Date(chart.providerSignedAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Chart content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <dl className="space-y-4">
          <DetailRow label="Chief Complaint" value={chart.chiefComplaint} />

          {!chart.template && (
            <>
              <JsonDisplay label="Areas Treated" value={chart.areasTreated} />
              <JsonDisplay label="Products Used" value={chart.productsUsed} />
              <DetailRow label="Dosage/Units" value={chart.dosageUnits} />

              <DetailRow label="Aftercare Notes" value={chart.aftercareNotes} />
              <DetailRow label="Additional Notes" value={chart.additionalNotes} />
            </>
          )}

          {chart.template && templateFields.length > 0 && (
            <>
              {templateFields.map((field) => {
                const val = templateValues[field.key];
                if (!val) return null;

                if (field.type === "json-areas" || field.type === "multiselect") {
                  return <JsonDisplay key={field.key} label={field.label} value={val} />;
                }
                if (field.type === "json-products") {
                  return <JsonDisplay key={field.key} label={field.label} value={val} />;
                }
                return <DetailRow key={field.key} label={field.label} value={val} />;
              })}
            </>
          )}
        </dl>
      </div>

      {/* Photos */}
      {chart.photos.length > 0 && (() => {
        const STANDARD_SLOTS = ["frontal", "angle-right", "angle-left", "profile"];
        const standardPhotos = chart.photos.filter(
          (p) => p.category && STANDARD_SLOTS.includes(p.category)
        );
        const extraPhotos = chart.photos.filter(
          (p) => !p.category || !STANDARD_SLOTS.includes(p.category)
        );

        return (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            {standardPhotos.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Photos</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {standardPhotos.map((photo) => (
                    <div key={photo.id} className="relative">
                      {photo.annotations ? (
                        <PhotoAnnotationRenderer
                          photoUrl={`/api/photos/${photo.id}`}
                          annotations={photo.annotations}
                        />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={`/api/photos/${photo.id}`}
                          alt={photo.filename}
                          className="w-full rounded-lg"
                        />
                      )}
                      {photo.category && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium bg-black/60 text-white rounded-full">
                          {photo.category}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {extraPhotos.length > 0 && (
              <div className={standardPhotos.length > 0 ? "border-t border-gray-200 pt-4" : ""}>
                <h2 className="text-sm font-semibold text-gray-900 mb-4">
                  {standardPhotos.length > 0 ? "Additional Photos" : "Photos"}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {extraPhotos.map((photo) => (
                    <div key={photo.id} className="relative">
                      {photo.annotations ? (
                        <PhotoAnnotationRenderer
                          photoUrl={`/api/photos/${photo.id}`}
                          annotations={photo.annotations}
                        />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={`/api/photos/${photo.id}`}
                          alt={photo.caption ?? photo.filename}
                          className="w-full rounded-lg"
                        />
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium bg-black/60 text-white rounded-full">
                        {photo.caption ?? photo.category ?? "Photo"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
