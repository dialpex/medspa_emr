"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircleIcon, Loader2Icon,
  ArrowLeftIcon, SaveIcon, FileTextIcon,
} from "lucide-react";
import { updateChart, providerSignChart } from "@/lib/actions/charts";
import { getEffectiveStatus } from "@/lib/encounter-utils";
import { ChartFormFields } from "./chart-form-fields";
import { PhotoAnnotator } from "@/components/photo-annotator";
import { AftercareConsent } from "@/components/aftercare-consent";
import { ChartAiContextPanel } from "@/components/chart-ai-context-panel";
import { SmartPhotoGallery } from "@/components/smart-photo-gallery";
import { ProcedureDetailsCard } from "@/components/procedure-details-card";

import { CollapsibleCard } from "@/components/ui/collapsible-card";
import type { PreviousTreatmentSummary } from "@/lib/actions/charts";
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
    caption: string | null;
    annotations: string | null;
    createdAt: Date;
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

  // Extra photos (non-standard-slot)
  const STANDARD_SLOTS = ["frontal", "angle-right", "angle-left", "profile"];
  const [extraPhotos, setExtraPhotos] = useState(() =>
    chart.photos
      .filter((p) => p.category && !STANDARD_SLOTS.includes(p.category))
      .map((p) => ({
        id: p.id,
        label: p.caption ?? p.category ?? "Untitled",
        annotations: p.annotations,
      }))
  );

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

  const handleExtraPhotoUpload = async (file: File, label: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("patientId", chart.patientId);
    formData.append("chartId", chart.id);
    formData.append("category", `custom-${Date.now()}`);
    formData.append("caption", label);

    const res = await fetch("/api/photos/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success && data.photo) {
      setExtraPhotos((prev) => [
        ...prev,
        { id: data.photo.id, label, annotations: null },
      ]);
    }
  };

  const handleExtraPhotoRemove = async (photoId: string) => {
    const { deletePhoto } = await import("@/lib/actions/photos");
    const result = await deletePhoto(photoId);
    if (result.success) {
      setExtraPhotos((prev) => prev.filter((p) => p.id !== photoId));
    }
  };

  const handleExtraPhotoAnnotate = (photoId: string) => {
    setAnnotatingSlot(photoId);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const [providerSigning, setProviderSigning] = useState(false);
  const [providerConfirming, setProviderConfirming] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const effectiveStatus = getEffectiveStatus(chart);
  const isLocked = effectiveStatus !== "Draft";

  const canProviderSign =
    effectiveStatus === "Draft" &&
    (currentUserRole === "Provider" || currentUserRole === "Owner" || currentUserRole === "Admin");

  const handleProviderSign = async () => {
    setSignError(null);

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
            extraPhotos={extraPhotos}
            onAddExtraPhoto={handleExtraPhotoUpload}
            onRemoveExtraPhoto={handleExtraPhotoRemove}
            onAnnotateExtraPhoto={handleExtraPhotoAnnotate}
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

          {signError && (
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
      {annotatingSlot && (() => {
        const isSlot = !!slotPhotos[annotatingSlot];
        const extraPhoto = extraPhotos.find((p) => p.id === annotatingSlot);
        const photoId = isSlot ? slotPhotos[annotatingSlot] : extraPhoto?.id;
        const initialAnnotations = isSlot
          ? (slotAnnotations[annotatingSlot] ?? null)
          : (extraPhoto?.annotations ?? null);

        if (!photoId) return null;

        return (
          <PhotoAnnotator
            photoId={photoId}
            photoUrl={`/api/photos/${photoId}`}
            initialAnnotations={initialAnnotations}
            onClose={() => {
              import("@/lib/actions/photos").then(({ getPhotosForChart }) => {
                getPhotosForChart(chart.id).then((photos) => {
                  const photo = photos.find((p) => p.id === photoId);
                  if (photo) {
                    if (isSlot) {
                      setSlotAnnotations((prev) => ({ ...prev, [annotatingSlot]: photo.annotations }));
                    } else {
                      setExtraPhotos((prev) =>
                        prev.map((ep) =>
                          ep.id === photoId ? { ...ep, annotations: photo.annotations } : ep
                        )
                      );
                    }
                  }
                  setAnnotatingSlot(null);
                });
              });
            }}
          />
        );
      })()}
    </div>
  );
}

