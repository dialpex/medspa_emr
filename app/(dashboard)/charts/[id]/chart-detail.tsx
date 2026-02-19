"use client";

import { ShieldCheckIcon, ClockIcon, UserIcon, ClipboardCheckIcon } from "lucide-react";
import { PhotoAnnotationRenderer } from "@/components/photo-annotation-renderer";
import { getEffectiveStatus } from "@/lib/encounter-utils";
import { parseStructuredData } from "@/lib/templates/schemas";
import { validateTreatmentCard, getCardStatus } from "@/lib/templates/validation";
import { CardStatusBadge } from "@/components/treatment-cards/card-status-badge";
import type { InjectableData, LaserData, EstheticsData } from "@/lib/templates/schemas";
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
    annotations: string | null;
  }>;
  treatmentCards: Array<{
    id: string;
    templateType: string;
    title: string;
    narrativeText: string;
    structuredData: string;
    sortOrder: number;
    photos: Array<{
      id: string;
      filename: string;
      category: string | null;
      annotations: string | null;
    }>;
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

      {/* Treatment Cards */}
      {chart.treatmentCards.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Treatment Cards</h2>
          <div className="space-y-4">
            {chart.treatmentCards.map((card) => {
              const validation = validateTreatmentCard(card.templateType, card.structuredData);
              const status = getCardStatus(validation);

              return (
                <div key={card.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-gray-900">{card.title}</h3>
                    <span className="px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-full">
                      {card.templateType}
                    </span>
                    <CardStatusBadge
                      status={status}
                      missingFields={[...validation.missingHighRiskFields, ...validation.missingNonCriticalFields]}
                    />
                  </div>

                  {/* Structured data display */}
                  <StructuredDataDisplay templateType={card.templateType} structuredData={card.structuredData} />

                  {card.narrativeText ? (
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase">Narrative Notes</dt>
                      <dd className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{card.narrativeText}</dd>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No narrative notes yet</p>
                  )}

                  {/* Treatment card photos */}
                  {card.photos && card.photos.length > 0 && (
                    <div>
                      <dt className="text-xs font-semibold text-gray-500 uppercase mb-2">Photos</dt>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {card.photos.map((photo) => (
                          <div key={photo.id} className="relative rounded-lg overflow-hidden border border-gray-200">
                            {photo.annotations ? (
                              <PhotoAnnotationRenderer
                                photoUrl={`/api/photos/${photo.id}`}
                                annotations={photo.annotations}
                                className="w-full [&_canvas]:w-full [&_canvas]:h-auto"
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
                              <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-medium bg-black/60 text-white rounded-full">
                                {photo.category}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Photos */}
      {chart.photos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Photos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {chart.photos.map((photo) => (
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
    </div>
  );
}

function StructuredDataDisplay({
  templateType,
  structuredData,
}: {
  templateType: string;
  structuredData: string;
}) {
  if (!structuredData || structuredData === "{}") return null;

  if (templateType === "Injectable") {
    const data = parseStructuredData<InjectableData>("Injectable", structuredData);
    if (!data.productName && data.areas.length === 0 && data.lotEntries.length === 0) return null;

    return (
      <dl className="space-y-2 text-sm">
        {data.productName && (
          <div>
            <dt className="text-xs font-semibold text-gray-500 uppercase">Product</dt>
            <dd className="text-gray-900">{data.productName}</dd>
          </div>
        )}
        {data.areas.length > 0 && (
          <div>
            <dt className="text-xs font-semibold text-gray-500 uppercase">Areas</dt>
            <dd>
              <table className="mt-1 text-sm">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="text-left pr-6 font-medium">Area</th>
                    <th className="text-right font-medium">Units</th>
                  </tr>
                </thead>
                <tbody>
                  {data.areas.map((a, i) => (
                    <tr key={`${a.areaLabel}-${i}`}>
                      <td className="pr-6 text-gray-900">{a.areaLabel}</td>
                      <td className="text-right text-gray-900">{a.units}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </dd>
          </div>
        )}
        {data.totalUnits > 0 && (
          <div>
            <dt className="text-xs font-semibold text-gray-500 uppercase">Total Units</dt>
            <dd className="text-gray-900">{data.totalUnits}</dd>
          </div>
        )}
        {data.lotEntries.length > 0 && (
          <div>
            <dt className="text-xs font-semibold text-gray-500 uppercase">Lot Entries</dt>
            <dd>
              <table className="mt-1 text-sm">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="text-left pr-6 font-medium">Lot #</th>
                    <th className="text-left font-medium">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lotEntries.map((l, i) => (
                    <tr key={`${l.lotNumber}-${i}`}>
                      <td className="pr-6 text-gray-900">{l.lotNumber}</td>
                      <td className="text-gray-900">{l.expirationDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </dd>
          </div>
        )}
        <DetailRow label="Outcome" value={data.outcome} />
        <DetailRow label="Follow-Up Plan" value={data.followUpPlan} />
        <DetailRow label="Aftercare" value={data.aftercare} />
      </dl>
    );
  }

  if (templateType === "Laser") {
    const data = parseStructuredData<LaserData>("Laser", structuredData);
    if (!data.deviceName && data.areasTreated.length === 0) return null;

    return (
      <dl className="space-y-2 text-sm">
        <DetailRow label="Device" value={data.deviceName} />
        {data.areasTreated.length > 0 && (
          <DetailRow label="Areas Treated" value={data.areasTreated.join(", ")} />
        )}
        {(data.parameters.energy || data.parameters.passes > 0) && (
          <div>
            <dt className="text-xs font-semibold text-gray-500 uppercase">Parameters</dt>
            <dd className="text-gray-900">
              {data.parameters.energy && <span className="mr-4">Energy: {data.parameters.energy}</span>}
              {data.parameters.pulseDuration && <span className="mr-4">Pulse: {data.parameters.pulseDuration}</span>}
              {data.parameters.passes > 0 && <span>Passes: {data.parameters.passes}</span>}
            </dd>
          </div>
        )}
        <DetailRow label="Outcome" value={data.outcome} />
        <DetailRow label="Aftercare" value={data.aftercare} />
      </dl>
    );
  }

  if (templateType === "Esthetics") {
    const data = parseStructuredData<EstheticsData>("Esthetics", structuredData);
    if (!data.areasTreated && !data.productsUsed) return null;

    return (
      <dl className="space-y-2 text-sm">
        <DetailRow label="Areas Treated" value={data.areasTreated} />
        <DetailRow label="Products Used" value={data.productsUsed} />
        <DetailRow label="Skin Response" value={data.skinResponse} />
        <DetailRow label="Outcome" value={data.outcome} />
        <DetailRow label="Aftercare" value={data.aftercare} />
      </dl>
    );
  }

  return null;
}
