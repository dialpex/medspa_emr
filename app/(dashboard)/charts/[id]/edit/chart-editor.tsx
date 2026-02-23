"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircleIcon, Loader2Icon, AlertCircleIcon, XIcon,
  PencilIcon, PlusIcon, SparklesIcon, MicIcon, SquareIcon,
  ArrowLeftIcon, SaveIcon, FileTextIcon,
} from "lucide-react";
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
import { AftercareConsent } from "@/components/aftercare-consent";
import { ChartAiContextPanel } from "@/components/chart-ai-context-panel";
import { SmartPhotoGallery } from "@/components/smart-photo-gallery";
import { ProcedureDetailsCard } from "@/components/procedure-details-card";

import { CollapsibleCard } from "@/components/ui/collapsible-card";
import type { PreviousTreatmentSummary } from "@/lib/actions/charts";
import type { InjectableData, LaserData, EstheticsData } from "@/lib/templates/schemas";
import type { TemplateFieldConfig } from "@/lib/types/charts";
import type { Role } from "@prisma/client";

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

const PHOTO_SLOTS = [
  { key: "frontal", label: "Frontal" },
  { key: "angle-right", label: "45° Right" },
  { key: "angle-left", label: "45° Left" },
  { key: "profile", label: "Profile" },
];

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
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    allergies: string | null;
    dateOfBirth: Date | null;
    tags: string | null;
    medicalNotes: string | null;
    appointments?: Array<{ startTime: Date }>;
  };
  encounter: { id: string; status: string } | null;
  template: { name: string; fieldsConfig: string } | null;
  appointment: { startTime: Date; service: { name: string } | null } | null;
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

function computeAge(dob: Date | null): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const monthDiff = today.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  return `${age}y`;
}

function parseAllergies(allergies: string | null): string[] {
  if (!allergies) return [];
  try {
    const parsed = JSON.parse(allergies);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // Not JSON, treat as comma-separated
  }
  return allergies.split(",").map((s) => s.trim()).filter(Boolean);
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? "s" : ""} ago`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} year${years > 1 ? "s" : ""} ago`;
}

function SaveStatusDot({ status }: { status: SaveStatus }) {
  const colors: Record<SaveStatus, string> = {
    saved: "bg-green-500",
    saving: "bg-amber-400 animate-pulse",
    unsaved: "bg-amber-500",
    error: "bg-red-500",
  };
  return <div className={`size-2.5 rounded-full ${colors[status]}`} />;
}

export function ChartEditor({
  chart,
  currentUserRole,
  previousTreatment,
  consentTemplates,
}: {
  chart: ChartData;
  currentUserRole: Role;
  previousTreatment: PreviousTreatmentSummary | null;
  consentTemplates: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Standard chart fields
  const [chiefComplaint, setChiefComplaint] = useState(chart.chiefComplaint ?? "");
  const [areasTreated, setAreasTreated] = useState(chart.areasTreated ?? "");
  const [additionalNotes, setAdditional] = useState(chart.additionalNotes ?? "");

  // Photo slots
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

  const pendingSaveRef = useRef<Record<string, string | undefined>>({});

  const autoSave = useCallback(
    (data: Record<string, string | undefined>) => {
      pendingSaveRef.current = { ...pendingSaveRef.current, ...data };
      setSaveStatus("unsaved");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const toSave = { ...pendingSaveRef.current };
        pendingSaveRef.current = {};
        setSaveStatus("saving");
        const result = await updateChart(chart.id, toSave);
        setSaveStatus(result.success ? "saved" : "error");
      }, 2000);
    },
    [chart.id]
  );

  const flushSave = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const toSave = { ...pendingSaveRef.current };
    pendingSaveRef.current = {};
    if (Object.keys(toSave).length === 0 && saveStatus === "saved") return;
    setSaveStatus("saving");
    const result = await updateChart(chart.id, toSave);
    setSaveStatus(result.success ? "saved" : "error");
  }, [chart.id, saveStatus]);

  const handleStandardChange = (field: string, value: string) => {
    const setters: Record<string, (v: string) => void> = {
      chiefComplaint: setChiefComplaint,
      areasTreated: setAreasTreated,
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

  // Computed patient info
  const age = computeAge(chart.patient.dateOfBirth);
  const allergyList = parseAllergies(chart.patient.allergies);
  const isVip = chart.patient.tags?.toLowerCase().includes("vip");
  const serviceName = chart.appointment?.service?.name;
  const dob = chart.patient.dateOfBirth
    ? new Date(chart.patient.dateOfBirth).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  const lastVisit = chart.patient.appointments?.[0]?.startTime;
  const initials = `${chart.patient.firstName.charAt(0)}${chart.patient.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Top Editing Bar */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <Link
          href="/charts"
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="size-5" />
        </Link>
        <span className="text-sm font-medium text-gray-700">
          Editing Chart:{" "}
          <span className="text-gray-900">{chart.patient.firstName} {chart.patient.lastName}</span>
        </span>
        <div className="flex items-center gap-2 ml-auto">
          {allergyList.map((allergy) => (
            <span
              key={allergy}
              className="px-2 py-0.5 text-[10px] font-bold uppercase bg-red-100 text-red-700 rounded"
            >
              Allergy: {allergy}
            </span>
          ))}
          {isVip && (
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-purple-100 text-purple-700 rounded">
              VIP Client
            </span>
          )}
        </div>
      </div>

      {/* Two-column container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column — Main Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
          {/* Patient Header Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="size-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-lg font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-bold text-gray-900">
                    {chart.patient.firstName} {chart.patient.lastName}
                  </h1>
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded">
                    ID: {chart.patient.id.slice(0, 8)}
                  </span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full">
                    Draft Autosaved
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                  {dob && <span>DOB: {dob}{age ? ` (${age})` : ""}</span>}
                  {lastVisit && (
                    <>
                      <span className="text-gray-300">|</span>
                      <span>Last Visit: {formatRelativeTime(lastVisit)}</span>
                    </>
                  )}
                  {serviceName && (
                    <>
                      <span className="text-gray-300">|</span>
                      <span className="uppercase text-xs font-semibold text-purple-600">
                        {serviceName}
                      </span>
                    </>
                  )}
                </div>
                {(allergyList.length > 0 || isVip) && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {allergyList.map((allergy) => (
                      <span
                        key={allergy}
                        className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full"
                      >
                        {allergy}
                      </span>
                    ))}
                    {isVip && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">
                        VIP
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Smart Photo Gallery */}
          <SmartPhotoGallery
            photos={slotPhotos}
            annotations={slotAnnotations}
            onUpload={handleSlotUpload}
            onRemove={handleSlotRemove}
            onAnnotate={setAnnotatingSlot}
            disabled={isLocked}
            uploading={uploadingSlot}
          />

          {/* Procedure Details */}
          <ProcedureDetailsCard
            chiefComplaint={chiefComplaint}
            onChiefComplaintChange={(v) => handleStandardChange("chiefComplaint", v)}
            areasTreated={areasTreated}
            onAreasTreatedChange={(v) => handleStandardChange("areasTreated", v)}
            disabled={isLocked}
          />

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

          {/* Treatment Cards — Products & Dosage for Injectable, full editor for others */}
          {chart.treatmentCards.length > 0 && (
            <div className="space-y-4">
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

          {/* Provider Notes */}
          {additionalNotes !== undefined && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Provider Notes</label>
              <textarea
                value={additionalNotes}
                onChange={(e) => handleStandardChange("additionalNotes", e.target.value)}
                disabled={isLocked}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
                placeholder="Additional observations or notes..."
              />
            </div>
          )}

          {/* Aftercare & Consent */}
          <CollapsibleCard
            icon={FileTextIcon}
            title="Aftercare & Consent"
            subtitle="Post-treatment instructions and consent documentation"
          >
            <AftercareConsent consentTemplates={consentTemplates} />
          </CollapsibleCard>
        </div>

        {/* Right Column — AI Context Panel */}
        <ChartAiContextPanel
          patientAllergies={chart.patient.allergies}
          patientMedicalNotes={chart.patient.medicalNotes}
          previousTreatment={previousTreatment}
        />
      </div>

      {/* Floating Bottom Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full shadow-lg px-4 py-2.5">
          <button
            type="button"
            onClick={flushSave}
            disabled={saveStatus === "saving"}
            className="relative flex items-center gap-1.5 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
            title="Save now"
          >
            {saveStatus === "saving" ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SaveIcon className="size-4" />
            )}
            <SaveStatusDot status={saveStatus} />
          </button>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {blockingCards.length > 0 && (
            <div className="max-w-sm">
              <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                <AlertCircleIcon className="size-3.5" />
                Incomplete: {blockingCards.map((c) => c.cardTitle).join(", ")}
              </p>
            </div>
          )}
          {signError && !blockingCards.length && (
            <p className="text-xs text-red-600">{signError}</p>
          )}

          {providerConfirming && (
            <button
              onClick={() => setProviderConfirming(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-full"
            >
              Cancel
            </button>
          )}

          {canProviderSign && (
            <button
              onClick={handleProviderSign}
              disabled={providerSigning}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-full disabled:opacity-50 transition-colors"
            >
              {providerSigning ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <CheckCircleIcon className="size-4" />
              )}
              {providerConfirming ? "Confirm Complete & Sign" : "Complete & Sign"}
            </button>
          )}
        </div>
      </div>

      {/* Photo Annotator Modal */}
      {annotatingSlot && slotPhotos[annotatingSlot] && (
        <PhotoAnnotator
          photoId={slotPhotos[annotatingSlot]}
          photoUrl={`/api/photos/${slotPhotos[annotatingSlot]}`}
          initialAnnotations={slotAnnotations[annotatingSlot] ?? null}
          onClose={() => {
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

  // AI Draft state
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
      // Silently fail
    }
    setAiLoading(false);
  };

  const handleApplyDraft = (result: { updatedStructuredData: Record<string, unknown>; updatedNarrativeText: string }) => {
    setStructured(result.updatedStructuredData);
    setNarrative(result.updatedNarrativeText);
    setShowPreview(false);
    setAiDraft(null);
    setAiSummary("");
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
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
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
      // Microphone permission denied
    }
  };

  const handleStopRecording = async () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === "inactive") return;

    mediaRecorder.stop();
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    await new Promise<void>((resolve) => {
      mediaRecorder.addEventListener("stop", () => resolve(), { once: true });
      if (mediaRecorder.state === "inactive") resolve();
    });

    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    if (audioBlob.size === 0) return;

    setVoiceProcessing(true);
    try {
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

      setVoiceProcessingStep("Transcribing...");
      const transcribeRes = await fetch(`/api/ai-drafts/${draftEventId}/transcribe`, {
        method: "POST",
      });
      const transcribeData = await transcribeRes.json();
      if (!transcribeRes.ok) throw new Error(transcribeData.error);

      setVoiceProcessingStep("Analyzing...");
      const structureRes = await fetch(`/api/ai-drafts/${draftEventId}/structure`, {
        method: "POST",
      });
      const structureData = await structureRes.json();
      if (!structureRes.ok) throw new Error(structureData.error);

      setAiDraft(structureData);
    } catch {
      // Pipeline failed
    }
    setVoiceProcessing(false);
    setVoiceProcessingStep("");
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const validation = validateTreatmentCard(card.templateType, JSON.stringify(structured));
  const cardStatus = getCardStatus(validation);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
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

      {/* Narrative Notes */}
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
                placeholder="Type a quick summary for AI..."
              />
            </>
          )}

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
