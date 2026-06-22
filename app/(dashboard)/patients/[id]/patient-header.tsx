"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Clock, Phone, Mail, Plus, AlertTriangle, Camera, X, ZoomIn, ZoomOut } from "lucide-react";
import type { PatientDetail } from "@/lib/actions/patients";
import { updatePatientAvatar } from "@/lib/actions/patients";
import { PatientAvatar } from "@/components/patient-avatar";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

function formatAge(dateOfBirth: Date | null): string | null {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `${age} years old`;
}

function formatDOB(dateOfBirth: Date | null): string | null {
  if (!dateOfBirth) return null;
  return new Date(dateOfBirth).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function getDisplayStatus(
  patient: PatientDetail,
  lastAppointmentDate: Date | null
): { label: string; colors: string } {
  if (patient.status === "Fired") {
    return { label: "Fired", colors: "bg-red-50 text-red-700 border-red-200" };
  }
  if (lastAppointmentDate) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    if (new Date(lastAppointmentDate) >= twelveMonthsAgo) {
      return { label: "Active", colors: "bg-green-50 text-green-700 border-green-200" };
    }
  }
  return { label: "Inactive", colors: "bg-gray-100 text-gray-600 border-gray-200" };
}

function PatientTags({ tags }: { tags: string | null }) {
  if (!tags) return null;
  const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
  if (tagList.length === 0) return null;
  return (
    <>
      {tagList.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center px-2.5 py-0.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full border border-purple-200"
        >
          {tag}
        </span>
      ))}
    </>
  );
}

function MedicalChips({
  allergies,
  medicalNotes,
}: {
  allergies: string | null;
  medicalNotes: string | null;
}) {
  if (!allergies && !medicalNotes) return null;
  return (
    <>
      {allergies && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-700 border border-red-200">
          <AlertTriangle className="size-3" />
          {allergies}
        </span>
      )}
      {medicalNotes && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="size-3" />
          {medicalNotes}
        </span>
      )}
    </>
  );
}

// ─── Avatar Crop Modal ──────────────────────────────────────

const CROP_SIZE = 256; // Output avatar size in px

function cropImageToBlob(
  img: HTMLImageElement,
  offsetX: number,
  offsetY: number,
  scale: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("Canvas not supported"));

    // The visible area maps to CROP_SIZE x CROP_SIZE
    // offsetX/Y are in "display" coordinates (relative to the viewport center)
    // scale controls the zoom level

    const drawWidth = img.naturalWidth * scale;
    const drawHeight = img.naturalHeight * scale;

    // Center of viewport is (CROP_SIZE/2, CROP_SIZE/2)
    // The image is drawn with its center at (CROP_SIZE/2 + offsetX, CROP_SIZE/2 + offsetY)
    const dx = CROP_SIZE / 2 - drawWidth / 2 + offsetX;
    const dy = CROP_SIZE / 2 - drawHeight / 2 + offsetY;

    ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to create blob"))),
      "image/jpeg",
      0.9
    );
  });
}

function AvatarCropModal({
  imageDataUrl,
  onConfirm,
  onCancel,
}: {
  imageDataUrl: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const viewportSize = 240; // display size of the crop circle

  // Calculate initial scale to fit the image so the shorter side fills the viewport
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
    imgRef.current = img;
    const fitScale = viewportSize / Math.min(img.naturalWidth, img.naturalHeight);
    setScale(fitScale);
    setOffset({ x: 0, y: 0 });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [offset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((prev) => Math.max(0.1, Math.min(5, prev - e.deltaY * 0.001)));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!imgRef.current) return;
    // Convert display coordinates to CROP_SIZE coordinates
    const ratio = CROP_SIZE / viewportSize;
    const blob = await cropImageToBlob(
      imgRef.current,
      offset.x * ratio,
      offset.y * ratio,
      scale * ratio
    );
    onConfirm(blob);
  }, [offset, scale, onConfirm]);

  const imgW = imgNatural.w * scale;
  const imgH = imgNatural.h * scale;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Position your photo</h3>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="size-5 text-gray-500" />
          </button>
        </div>

        <p className="text-sm text-gray-500">Drag to reposition. Scroll or use the slider to zoom.</p>

        {/* Crop viewport */}
        <div className="flex justify-center">
          <div
            className="relative overflow-hidden rounded-full border-2 border-purple-300 cursor-grab active:cursor-grabbing"
            style={{ width: viewportSize, height: viewportSize }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageDataUrl}
              alt="Crop preview"
              draggable={false}
              onLoad={handleImageLoad}
              className="absolute select-none"
              style={{
                width: imgW,
                height: imgH,
                left: viewportSize / 2 - imgW / 2 + offset.x,
                top: viewportSize / 2 - imgH / 2 + offset.y,
              }}
            />
          </div>
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 px-2">
          <ZoomOut className="size-4 text-gray-400 flex-shrink-0" />
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="flex-1 accent-purple-600"
          />
          <ZoomIn className="size-4 text-gray-400 flex-shrink-0" />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Uploadable Avatar ──────────────────────────────────────

function UploadableAvatar({ patient }: { patient: PatientDetail }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    patient.avatarPhotoId ? `/api/photos/${patient.avatarPhotoId}` : null
  );
  const [cropImage, setCropImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync avatar URL when patient prop changes (e.g. after revalidation)
  const currentAvatarPhotoId = patient.avatarPhotoId;
  const [lastSyncedId, setLastSyncedId] = useState(currentAvatarPhotoId);
  if (currentAvatarPhotoId !== lastSyncedId) {
    setLastSyncedId(currentAvatarPhotoId);
    setAvatarUrl(currentAvatarPhotoId ? `/api/photos/${currentAvatarPhotoId}` : null);
  }

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > MAX_AVATAR_BYTES) {
      setError("Photo must be under 2 MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Only JPEG or PNG allowed");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Read file to data URL for crop preview
    const reader = new FileReader();
    reader.onload = () => setCropImage(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleCropConfirm = useCallback(async (blob: Blob) => {
    setCropImage(null);
    setUploading(true);
    setError(null);
    try {
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("patientId", patient.id);
      formData.append("category", "avatar");

      const res = await fetch("/api/photos/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Upload failed (${res.status})`);
      }

      const data = await res.json();
      if (!data.photo?.id) {
        throw new Error("Upload response missing photo ID");
      }

      await updatePatientAvatar(patient.id, data.photo.id);
      setAvatarUrl(`/api/photos/${data.photo.id}?t=${Date.now()}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      console.error("[AvatarUpload]", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [patient.id]);

  const handleCropCancel = useCallback(() => {
    setCropImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <div className="relative group">
          <PatientAvatar
            firstName={patient.firstName}
            lastName={patient.lastName}
            size="lg"
            imageUrl={avatarUrl}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Upload avatar photo"
          >
            <Camera className="size-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleFileSelect}
          />
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
              <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-600 max-w-[120px] text-center">{error}</p>
        )}
      </div>

      {cropImage && (
        <AvatarCropModal
          imageDataUrl={cropImage}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
}

// ─── Patient Header ─────────────────────────────────────────

export function PatientHeader({
  patient,
  canViewCharts,
  lastAppointmentDate,
}: {
  patient: PatientDetail;
  canViewCharts: boolean;
  lastAppointmentDate: Date | null;
}) {
  const age = formatAge(patient.dateOfBirth);
  const dob = formatDOB(patient.dateOfBirth);
  const displayStatus = getDisplayStatus(patient, lastAppointmentDate);

  return (
    <div className="rounded-lg border bg-white shadow-sm p-6">
      <div className="flex items-start justify-between gap-4">
        {/* Left: avatar + info */}
        <div className="flex items-start gap-5 min-w-0">
          <UploadableAvatar patient={patient} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {patient.firstName} {patient.lastName}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${displayStatus.colors}`}>
                {displayStatus.label}
              </span>
              <PatientTags tags={patient.tags} />
              <MedicalChips allergies={patient.allergies} medicalNotes={patient.medicalNotes} />
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
              {dob && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {dob} ({age})
                </span>
              )}
              {patient.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3.5" />
                  {patient.phone}
                </span>
              )}
              {patient.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3.5" />
                  {patient.email}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {patient.phone && (
            <a
              href={`tel:${patient.phone}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Phone className="size-4" />
              Call
            </a>
          )}
          {patient.email && (
            <a
              href={`mailto:${patient.email}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Mail className="size-4" />
              Email
            </a>
          )}
          {canViewCharts && (
            <Link
              href={`/charts/new?patientId=${patient.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="size-4" />
              Create Chart
            </Link>
          )}
        </div>
      </div>

    </div>
  );
}
