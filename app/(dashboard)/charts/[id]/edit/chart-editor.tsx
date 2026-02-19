"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon, Loader2Icon, AlertCircleIcon, CameraIcon, XIcon, PencilIcon, PlusIcon, SparklesIcon, MicIcon, SquareIcon } from "lucide-react";
import { updateChart, updateTreatmentCard, providerSignChart } from "@/lib/actions/charts";
import { getEffectiveStatus } from "@/lib/encounter-utils";
import { parseStructuredData } from "@/lib/templates/schemas";
import { validateTreatmentCard, getCardStatus } from "@/lib/templates/validation";
import { ChartFormFields } from "./chart-form-fields";
import { PhotoAnnotator } from "@/components/photo-annotator";
import { PhotoAnnotationRenderer } from "@/components/photo-annotation-renderer";
import { InjectableFields } from "@/components/treatment-cards/injectable-fields";
import { LaserFields } from "@/components/treatment-cards/laser-fields";
import { EstheticsFields } from "@/components/treatment-cards/esthetics-fields";
import { CardStatusBadge } from "@/components/treatment-cards/card-status-badge";
import { AiDraftPreviewModal } from "@/components/ai-draft-preview-modal";
import type { InjectableData, LaserData, EstheticsData } from "@/lib/templates/schemas";
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
  encounter: { id: string; status: string } | null;
  template: { name: string; fieldsConfig: string } | null;
  photos: Array<{
    id: string;
    filename: string;
    category: string | null;
    annotations: string | null;
    createdAt: Date;
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
      createdAt: Date;
    }>;
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

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const [providerSigning, setProviderSigning] = useState(false);
  const [providerConfirming, setProviderConfirming] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [blockingCards, setBlockingCards] = useState<
    Array<{ cardTitle: string; missingFields: string[] }>
  >([]);

  const effectiveStatus = getEffectiveStatus(chart);
  const isLocked = effectiveStatus !== "Draft";

  const canProviderSign =
    effectiveStatus === "Draft" &&
    (currentUserRole === "Provider" || currentUserRole === "Owner" || currentUserRole === "Admin");

  const handleProviderSign = async () => {
    setSignError(null);
    setBlockingCards([]);

    // Client-side validation
    const blocking: Array<{ cardTitle: string; missingFields: string[] }> = [];
    for (const card of chart.treatmentCards) {
      const result = validateTreatmentCard(card.templateType, card.structuredData);
      if (result.isSignBlocking) {
        blocking.push({ cardTitle: card.title, missingFields: result.missingHighRiskFields });
      }
    }
    if (blocking.length > 0) {
      setBlockingCards(blocking);
      return;
    }

    if (!providerConfirming) {
      setProviderConfirming(true);
      return;
    }

    setProviderSigning(true);
    const result = await providerSignChart(chart.id);
    if (result.success) {
      router.push(`/charts/${chart.id}`);
      router.refresh();
    } else {
      setSignError(result.error ?? "Failed to sign");
      const data = result.data as { blockingErrors?: Array<{ cardTitle: string; missingFields: string[] }> } | undefined;
      if (data?.blockingErrors) setBlockingCards(data.blockingErrors);
    }
    setProviderSigning(false);
    setProviderConfirming(false);
  };

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
                disabled={isLocked}
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
              disabled={isLocked}
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
                  disabled={isLocked}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                  placeholder="e.g. Forehead, Glabella"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Products Used</label>
                <textarea
                  value={productsUsed}
                  onChange={(e) => handleStandardChange("productsUsed", e.target.value)}
                  disabled={isLocked}
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
                  disabled={isLocked}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aftercare Notes</label>
                <textarea
                  value={aftercareNotes}
                  onChange={(e) => handleStandardChange("aftercareNotes", e.target.value)}
                  disabled={isLocked}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => handleStandardChange("additionalNotes", e.target.value)}
                  disabled={isLocked}
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
            disabled={isLocked}
            chartId={chart.id}
            patientId={chart.patientId}
          />
        </div>
      )}

      {/* Treatment Cards */}
      {chart.treatmentCards.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Treatment Cards</h2>
          {chart.treatmentCards.map((card) => (
            <TreatmentCardEditor
              key={card.id}
              card={card}
              chartId={chart.id}
              patientId={chart.patientId}
              disabled={isLocked}
            />
          ))}
        </div>
      )}

      {/* Complete & Sign */}
      {canProviderSign && (
        <div className="space-y-3">
          {blockingCards.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
              <p className="text-sm font-medium text-red-700 flex items-center gap-1.5">
                <AlertCircleIcon className="size-4" />
                Cannot sign — high-risk fields incomplete:
              </p>
              <ul className="text-sm text-red-600 ml-6 list-disc space-y-0.5">
                {blockingCards.map((card) => (
                  <li key={card.cardTitle}>
                    <span className="font-medium">{card.cardTitle}:</span>{" "}
                    {card.missingFields.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {signError && !blockingCards.length && (
            <p className="text-sm text-red-600">{signError}</p>
          )}

          <div className="flex items-center justify-end gap-3">
            {providerConfirming && (
              <button
                onClick={() => setProviderConfirming(false)}
                className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleProviderSign}
              disabled={providerSigning}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              {providerSigning ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <CheckCircleIcon className="size-4" />
              )}
              {providerConfirming ? "Confirm Complete & Sign" : "Complete & Sign"}
            </button>
          </div>
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

function TreatmentCardEditor({
  card,
  chartId,
  patientId,
  disabled,
}: {
  card: {
    id: string;
    templateType: string;
    title: string;
    narrativeText: string;
    structuredData: string;
    photos: Array<{
      id: string;
      filename: string;
      category: string | null;
      annotations: string | null;
      createdAt: Date;
    }>;
  };
  chartId: string;
  patientId: string;
  disabled: boolean;
}) {
  const [narrative, setNarrative] = useState(card.narrativeText);
  const [structured, setStructured] = useState(() =>
    parseStructuredData(card.templateType, card.structuredData)
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // AI Draft state (shared between typed and voice)
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<{
    draftEventId: string;
    structuredPatch: Record<string, unknown>;
    narrativeDraftText: string;
    missingHighRisk: Array<{ field: string; reason: string }>;
    conflicts: Array<{ field: string; existing: unknown; proposed: unknown }>;
    warnings: string[];
    transcriptText?: string;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceProcessingStep, setVoiceProcessingStep] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Photo state
  const [photos, setPhotos] = useState(card.photos);
  const [uploading, setUploading] = useState(false);
  const [annotatingPhotoId, setAnnotatingPhotoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handlePhotoUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("patientId", patientId);
    formData.append("chartId", chartId);
    formData.append("treatmentCardId", card.id);
    const res = await fetch("/api/photos/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success && data.photo) {
      setPhotos((prev) => [...prev, data.photo]);
    }
    setUploading(false);
  };

  const handlePhotoRemove = async (photoId: string) => {
    const { deletePhoto } = await import("@/lib/actions/photos");
    const result = await deletePhoto(photoId);
    if (result.success) {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    }
  };

  const scheduleAutoSave = useCallback(
    (narrativeVal: string, structuredVal: unknown) => {
      setSaveStatus("unsaved");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        const result = await updateTreatmentCard(card.id, {
          narrativeText: narrativeVal,
          structuredData: JSON.stringify(structuredVal),
        });
        setSaveStatus(result.success ? "saved" : "error");
      }, 2000);
    },
    [card.id]
  );

  const handleNarrativeChange = (value: string) => {
    setNarrative(value);
    scheduleAutoSave(value, structured);
  };

  const handleStructuredChange = (data: unknown) => {
    setStructured(data);
    scheduleAutoSave(narrative, data);
  };

  const handleGenerateDraft = async () => {
    if (!aiSummary.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await fetch(`/api/treatment-cards/${card.id}/ai/typed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summaryText: aiSummary }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiDraft(data);
      }
    } catch {
      // Silently fail — user can retry
    }
    setAiLoading(false);
  };

  const handleApplyDraft = (result: { updatedStructuredData: Record<string, unknown>; updatedNarrativeText: string }) => {
    setStructured(result.updatedStructuredData);
    setNarrative(result.updatedNarrativeText);
    setShowPreview(false);
    setAiDraft(null);
    setAiSummary("");
    // Trigger auto-save with new data
    scheduleAutoSave(result.updatedNarrativeText, result.updatedStructuredData);
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      // Microphone permission denied or unavailable
    }
  };

  const handleStopRecording = async () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === "inactive") return;

    // Stop recording
    mediaRecorder.stop();
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    // Wait for final data
    await new Promise<void>((resolve) => {
      mediaRecorder.addEventListener("stop", () => resolve(), { once: true });
      if (mediaRecorder.state === "inactive") resolve();
    });

    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    if (audioBlob.size === 0) return;

    // Pipeline: upload -> transcribe -> structure
    setVoiceProcessing(true);
    try {
      // 1. Upload
      setVoiceProcessingStep("Uploading audio...");
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      const uploadRes = await fetch(`/api/treatment-cards/${card.id}/ai/voice/upload`, {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error);
      const { draftEventId } = uploadData;

      // 2. Transcribe
      setVoiceProcessingStep("Transcribing...");
      const transcribeRes = await fetch(`/api/ai-drafts/${draftEventId}/transcribe`, {
        method: "POST",
      });
      const transcribeData = await transcribeRes.json();
      if (!transcribeRes.ok) throw new Error(transcribeData.error);

      // 3. Structure
      setVoiceProcessingStep("Analyzing...");
      const structureRes = await fetch(`/api/ai-drafts/${draftEventId}/structure`, {
        method: "POST",
      });
      const structureData = await structureRes.json();
      if (!structureRes.ok) throw new Error(structureData.error);

      setAiDraft(structureData);
    } catch {
      // Pipeline failed - user can retry
    }
    setVoiceProcessing(false);
    setVoiceProcessingStep("");
  };

  // Cleanup recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Validation for badge
  const validation = validateTreatmentCard(card.templateType, JSON.stringify(structured));
  const cardStatus = getCardStatus(validation);

  return (
    <div className="border border-gray-100 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-900">{card.title}</h3>
          <span className="px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-full">
            {card.templateType}
          </span>
          <CardStatusBadge
            status={cardStatus}
            missingFields={[...validation.missingHighRiskFields, ...validation.missingNonCriticalFields]}
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {saveStatus === "saved" && (
            <><CheckCircleIcon className="size-3.5 text-green-500" /><span className="text-green-600">Saved</span></>
          )}
          {saveStatus === "saving" && (
            <><Loader2Icon className="size-3.5 animate-spin text-gray-400" /><span className="text-gray-500">Saving...</span></>
          )}
          {saveStatus === "unsaved" && <span className="text-amber-600">Unsaved</span>}
          {saveStatus === "error" && (
            <><AlertCircleIcon className="size-3.5 text-red-500" /><span className="text-red-600">Failed</span></>
          )}
        </div>
      </div>

      {/* Structured fields by template type */}
      {card.templateType === "Injectable" && (
        <InjectableFields
          data={structured as InjectableData}
          onChange={handleStructuredChange}
          disabled={disabled}
        />
      )}
      {card.templateType === "Laser" && (
        <LaserFields
          data={structured as LaserData}
          onChange={handleStructuredChange}
          disabled={disabled}
        />
      )}
      {card.templateType === "Esthetics" && (
        <EstheticsFields
          data={structured as EstheticsData}
          onChange={handleStructuredChange}
          disabled={disabled}
        />
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Narrative Notes</label>
        <textarea
          value={narrative}
          onChange={(e) => handleNarrativeChange(e.target.value)}
          disabled={disabled}
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
          placeholder="Document treatment details, observations, and notes..."
        />
      </div>

      {/* AI Draft Section */}
      {!disabled && card.templateType !== "Other" && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">AI Draft</label>

          {/* Voice Recording Controls */}
          <div className="flex items-center gap-2">
            {!isRecording && !voiceProcessing && !aiDraft && (
              <button
                type="button"
                onClick={handleStartRecording}
                disabled={aiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <MicIcon className="size-4" />
                Record Voice Note
              </button>
            )}
            {isRecording && (
              <button
                type="button"
                onClick={handleStopRecording}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors animate-pulse"
              >
                <SquareIcon className="size-3.5 fill-current" />
                Stop Recording
                <span className="flex items-center gap-1.5 ml-1">
                  <span className="size-2 bg-white rounded-full animate-pulse" />
                  <span className="tabular-nums">
                    {Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:
                    {(recordingSeconds % 60).toString().padStart(2, "0")}
                  </span>
                </span>
              </button>
            )}
            {voiceProcessing && (
              <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-700">
                <Loader2Icon className="size-4 animate-spin" />
                {voiceProcessingStep}
              </div>
            )}
          </div>

          {/* Typed summary input */}
          {!isRecording && !voiceProcessing && !aiDraft && (
            <>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="flex-1 border-t border-gray-200" />
                <span>or type a summary</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>
              <textarea
                value={aiSummary}
                onChange={(e) => setAiSummary(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                placeholder="Type a quick summary for AI... (e.g. Botox 20 units forehead, 10 units glabella, lot C1234 exp 2027-06)"
              />
            </>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {!aiDraft && !isRecording && !voiceProcessing && aiSummary.trim() && (
              <button
                type="button"
                onClick={handleGenerateDraft}
                disabled={aiLoading || !aiSummary.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {aiLoading ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SparklesIcon className="size-4" />
                )}
                {aiLoading ? "Generating..." : "Generate Draft"}
              </button>
            )}
            {aiDraft && (
              <>
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                >
                  <SparklesIcon className="size-4" />
                  Review Draft
                  <span className="px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                    {Object.keys(aiDraft.structuredPatch).filter(
                      (k) => {
                        const v = aiDraft.structuredPatch[k];
                        return v !== undefined && v !== null && v !== "" && v !== 0;
                      }
                    ).length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { setAiDraft(null); setAiSummary(""); }}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* AI Draft Preview Modal */}
      {showPreview && aiDraft && (
        <AiDraftPreviewModal
          draft={aiDraft}
          currentNarrative={narrative}
          onApply={handleApplyDraft}
          onDiscard={() => setShowPreview(false)}
        />
      )}

      {/* Treatment Card Photos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">Photos</label>
          {!disabled && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
            >
              {uploading ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <PlusIcon className="size-3.5" />
              )}
              {uploading ? "Uploading..." : "Add Photo"}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhotoUpload(file);
              e.target.value = "";
            }}
          />
        </div>
        {photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((photo) => (
              <div key={photo.id} className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group">
                {photo.annotations ? (
                  <div
                    className="w-full h-full cursor-pointer"
                    onClick={!disabled ? () => setAnnotatingPhotoId(photo.id) : undefined}
                  >
                    <PhotoAnnotationRenderer
                      photoUrl={`/api/photos/${photo.id}`}
                      annotations={photo.annotations}
                      className="w-full h-full [&_canvas]:w-full [&_canvas]:h-full [&_canvas]:object-cover [&_canvas]:rounded-none"
                    />
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/photos/${photo.id}`}
                    alt={photo.filename}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={!disabled ? () => setAnnotatingPhotoId(photo.id) : undefined}
                  />
                )}
                {!disabled && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setAnnotatingPhotoId(photo.id)}
                      className="p-1 bg-white/90 rounded-full text-gray-600 hover:bg-white shadow-sm"
                      title="Annotate"
                    >
                      <PencilIcon className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePhotoRemove(photo.id)}
                      className="p-1 bg-white/90 rounded-full text-red-500 hover:bg-white shadow-sm"
                      title="Remove"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo Annotator Modal */}
      {annotatingPhotoId && (
        <PhotoAnnotator
          photoId={annotatingPhotoId}
          photoUrl={`/api/photos/${annotatingPhotoId}`}
          initialAnnotations={photos.find((p) => p.id === annotatingPhotoId)?.annotations ?? null}
          onClose={() => {
            // Refresh annotations for this photo
            import("@/lib/actions/photos").then(({ getPhotosForTreatmentCard }) => {
              getPhotosForTreatmentCard(card.id).then((freshPhotos) => {
                const fresh = freshPhotos.find((p) => p.id === annotatingPhotoId);
                if (fresh) {
                  setPhotos((prev) => prev.map((p) => p.id === fresh.id ? { ...p, annotations: fresh.annotations } : p));
                }
                setAnnotatingPhotoId(null);
              });
            });
          }}
        />
      )}
    </div>
  );
}
