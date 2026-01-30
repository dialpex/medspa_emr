"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon, Loader2Icon, AlertCircleIcon, CameraIcon, XIcon, PencilIcon } from "lucide-react";
import { updateChart, submitChartForReview } from "@/lib/actions/charts";
import { ChartFormFields } from "./chart-form-fields";
import { PhotoAnnotator } from "@/components/photo-annotator";
import { PhotoAnnotationRenderer } from "@/components/photo-annotation-renderer";
import type { TemplateFieldConfig } from "@/lib/types/charts";
import type { Role } from "@prisma/client";

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

type ChartData = {
  id: string;
  status: string;
  patientId: string;
  chiefComplaint: string | null;
  areasTreated: string | null;
  productsUsed: string | null;
  dosageUnits: string | null;
  aftercareNotes: string | null;
  additionalNotes: string | null;
  patient: { firstName: string; lastName: string; allergies: string | null };
  template: { name: string; fieldsConfig: string } | null;
  photos: Array<{
    id: string;
    filename: string;
    category: string | null;
    annotations: string | null;
    createdAt: Date;
  }>;
};

const PHOTO_SLOTS = [
  { key: "frontal", label: "Frontal" },
  { key: "angle", label: "Angle" },
  { key: "profile", label: "Profile" },
];

function ChartPhotoSlot({
  label,
  photoId,
  annotations,
  onUpload,
  onRemove,
  onAnnotate,
  disabled,
  uploading,
}: {
  label: string;
  photoId: string;
  annotations: string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onAnnotate: () => void;
  disabled?: boolean;
  uploading?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-full">
        {photoId ? (
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 shadow-sm">
            {annotations ? (
              <div
                className="w-full h-full cursor-pointer"
                onClick={!disabled ? onAnnotate : undefined}
              >
                <PhotoAnnotationRenderer
                  photoUrl={`/api/photos/${photoId}`}
                  annotations={annotations}
                  className="w-full h-full [&_canvas]:w-full [&_canvas]:h-full [&_canvas]:object-cover [&_canvas]:rounded-none"
                />
              </div>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${photoId}`}
                  alt={label}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={!disabled ? onAnnotate : undefined}
                />
              </>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={onRemove}
                className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
            {!disabled && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onAnnotate}
                  className="p-1.5 bg-white/90 rounded-full text-gray-600 hover:bg-white shadow-sm transition-colors"
                  title="Annotate"
                >
                  <PencilIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="p-1.5 bg-white/90 rounded-full text-gray-600 hover:bg-white shadow-sm transition-colors"
                  title="Replace photo"
                >
                  <CameraIcon className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-purple-400 hover:text-purple-500 hover:bg-purple-50/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <div className="size-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
            ) : (
              <CameraIcon className="size-6" />
            )}
            <span className="text-[11px] font-medium">
              {uploading ? "Uploading..." : "Add Photo"}
            </span>
          </button>
        )}
      </div>
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function ChartEditor({
  chart,
  currentUserRole,
}: {
  chart: ChartData;
  currentUserRole: Role;
}) {
  const router = useRouter();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Standard chart fields
  const [chiefComplaint, setChiefComplaint] = useState(chart.chiefComplaint ?? "");
  const [areasTreated, setAreasTreated] = useState(chart.areasTreated ?? "");
  const [productsUsed, setProductsUsed] = useState(chart.productsUsed ?? "");
  const [dosageUnits, setDosageUnits] = useState(chart.dosageUnits ?? "");
  const [aftercareNotes, setAftercare] = useState(chart.aftercareNotes ?? "");
  const [additionalNotes, setAdditional] = useState(chart.additionalNotes ?? "");

  // Photo slots: { frontal: "photoId", angle: "photoId", profile: "photoId" }
  const [slotPhotos, setSlotPhotos] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of chart.photos) {
      if (p.category && PHOTO_SLOTS.some((s) => s.key === p.category)) {
        map[p.category] = p.id;
      }
    }
    return map;
  });
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [slotAnnotations, setSlotAnnotations] = useState<Record<string, string | null>>(() => {
    const map: Record<string, string | null> = {};
    for (const p of chart.photos) {
      if (p.category && PHOTO_SLOTS.some((s) => s.key === p.category)) {
        map[p.category] = p.annotations;
      }
    }
    return map;
  });
  const [annotatingSlot, setAnnotatingSlot] = useState<string | null>(null);

  // Template custom fields
  const [templateValues, setTemplateValues] = useState<Record<string, string>>(() => {
    if (chart.template && chart.additionalNotes) {
      try { return JSON.parse(chart.additionalNotes); } catch { return {}; }
    }
    return {};
  });

  const templateFields: TemplateFieldConfig[] = chart.template
    ? JSON.parse(chart.template.fieldsConfig)
    : [];

  const autoSave = useCallback(
    (data: Record<string, string | undefined>) => {
      setSaveStatus("unsaved");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        const result = await updateChart(chart.id, data);
        setSaveStatus(result.success ? "saved" : "error");
      }, 2000);
    },
    [chart.id]
  );

  const handleStandardChange = (field: string, value: string) => {
    const setters: Record<string, (v: string) => void> = {
      chiefComplaint: setChiefComplaint,
      areasTreated: setAreasTreated,
      productsUsed: setProductsUsed,
      dosageUnits: setDosageUnits,
      aftercareNotes: setAftercare,
      additionalNotes: setAdditional,
    };
    setters[field]?.(value);
    autoSave({ [field]: value });
  };

  const handleTemplateChange = (key: string, value: string) => {
    const newValues = { ...templateValues, [key]: value };
    setTemplateValues(newValues);
    autoSave({ additionalNotes: JSON.stringify(newValues) });
  };

  const handleSlotUpload = async (slotKey: string, file: File) => {
    setUploadingSlot(slotKey);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("patientId", chart.patientId);
    formData.append("chartId", chart.id);
    formData.append("category", slotKey);

    const res = await fetch("/api/photos/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success && data.photo) {
      setSlotPhotos((prev) => ({ ...prev, [slotKey]: data.photo.id }));
    }
    setUploadingSlot(null);
  };

  const handleSlotRemove = (slotKey: string) => {
    setSlotPhotos((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  };

  const handleSubmitForReview = async () => {
    setSubmitting(true);
    const result = await submitChartForReview(chart.id);
    if (result.success) {
      router.push(`/charts/${chart.id}`);
      router.refresh();
    }
    setSubmitting(false);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const isSigned = chart.status === "MDSigned";

  return (
    <div className="max-w-3xl mx-auto space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {chart.patient.firstName} {chart.patient.lastName}
          </h1>
          {chart.template && (
            <p className="text-sm text-gray-500 mt-1">{chart.template.name}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm">
            {saveStatus === "saved" && (
              <><CheckCircleIcon className="size-4 text-green-500" /><span className="text-green-600">Saved</span></>
            )}
            {saveStatus === "saving" && (
              <><Loader2Icon className="size-4 animate-spin text-gray-400" /><span className="text-gray-500">Saving...</span></>
            )}
            {saveStatus === "unsaved" && <span className="text-amber-600">Unsaved changes</span>}
            {saveStatus === "error" && (
              <><AlertCircleIcon className="size-4 text-red-500" /><span className="text-red-600">Save failed</span></>
            )}
          </div>
          {chart.status === "Draft" && (
            <button
              onClick={handleSubmitForReview}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {submitting && <Loader2Icon className="size-4 animate-spin" />}
              Submit for Review
            </button>
          )}
        </div>
      </div>

      {/* Allergies */}
      {chart.patient.allergies && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
          <AlertCircleIcon className="size-4 text-red-500" />
          <span className="text-sm text-red-700">
            <strong>Allergies:</strong> {chart.patient.allergies}
          </span>
        </div>
      )}

      {/* Chart Details Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="text-sm font-semibold text-gray-900">Chart Details</h2>

        {/* Photo slots row */}
        {!chart.template && (
          <div className="grid grid-cols-3 gap-4">
            {PHOTO_SLOTS.map((slot) => (
              <ChartPhotoSlot
                key={slot.key}
                label={slot.label}
                photoId={slotPhotos[slot.key] ?? ""}
                annotations={slotAnnotations[slot.key] ?? null}
                onUpload={(f) => handleSlotUpload(slot.key, f)}
                onRemove={() => handleSlotRemove(slot.key)}
                onAnnotate={() => setAnnotatingSlot(slot.key)}
                disabled={isSigned}
                uploading={uploadingSlot === slot.key}
              />
            ))}
          </div>
        )}

        {/* Form fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint</label>
            <textarea
              value={chiefComplaint}
              onChange={(e) => handleStandardChange("chiefComplaint", e.target.value)}
              disabled={isSigned}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
              placeholder="Reason for visit..."
            />
          </div>

          {!chart.template && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Areas Treated</label>
                <input
                  type="text"
                  value={areasTreated}
                  onChange={(e) => handleStandardChange("areasTreated", e.target.value)}
                  disabled={isSigned}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                  placeholder="e.g. Forehead, Glabella"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Products Used</label>
                <textarea
                  value={productsUsed}
                  onChange={(e) => handleStandardChange("productsUsed", e.target.value)}
                  disabled={isSigned}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dosage/Units</label>
                <input
                  type="text"
                  value={dosageUnits}
                  onChange={(e) => handleStandardChange("dosageUnits", e.target.value)}
                  disabled={isSigned}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aftercare Notes</label>
                <textarea
                  value={aftercareNotes}
                  onChange={(e) => handleStandardChange("aftercareNotes", e.target.value)}
                  disabled={isSigned}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => handleStandardChange("additionalNotes", e.target.value)}
                  disabled={isSigned}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Template-driven fields */}
      {chart.template && templateFields.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <ChartFormFields
            fields={templateFields}
            values={templateValues}
            onChange={handleTemplateChange}
            disabled={isSigned}
            chartId={chart.id}
            patientId={chart.patientId}
          />
        </div>
      )}

      {/* Photo Annotator Modal */}
      {annotatingSlot && slotPhotos[annotatingSlot] && (
        <PhotoAnnotator
          photoId={slotPhotos[annotatingSlot]}
          photoUrl={`/api/photos/${slotPhotos[annotatingSlot]}`}
          initialAnnotations={slotAnnotations[annotatingSlot] ?? null}
          onClose={() => {
            // Refresh annotations from server for this photo
            import("@/lib/actions/photos").then(({ getPhotosForChart }) => {
              getPhotosForChart(chart.id).then((photos) => {
                const photo = photos.find((p) => p.id === slotPhotos[annotatingSlot]);
                if (photo) {
                  setSlotAnnotations((prev) => ({ ...prev, [annotatingSlot]: photo.annotations }));
                }
                setAnnotatingSlot(null);
              });
            });
          }}
        />
      )}
    </div>
  );
}
