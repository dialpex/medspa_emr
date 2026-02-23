"use client";

import { useRef, useState } from "react";
import { CameraIcon, XIcon, PencilIcon, ImageIcon, UploadIcon } from "lucide-react";
import { PhotoAnnotationRenderer } from "@/components/photo-annotation-renderer";

const PHOTO_SLOTS = [
  { key: "frontal", label: "FRONTAL" },
  { key: "angle-right", label: "45° RIGHT" },
  { key: "angle-left", label: "45° LEFT" },
  { key: "profile", label: "PROFILE" },
] as const;

export type ExtraPhoto = {
  id: string;
  label: string;
  annotations: string | null;
};

interface SmartPhotoGalleryProps {
  photos: Record<string, string>;
  annotations: Record<string, string | null>;
  onUpload: (slotKey: string, file: File) => void;
  onRemove: (slotKey: string) => void;
  onAnnotate: (slotKey: string) => void;
  disabled?: boolean;
  uploading: string | null;
  extraPhotos: ExtraPhoto[];
  onAddExtraPhoto: (file: File, label: string) => void;
  onRemoveExtraPhoto: (photoId: string) => void;
  onAnnotateExtraPhoto: (photoId: string) => void;
}

function PhotoSlot({
  slotKey,
  label,
  photoId,
  slotAnnotations,
  onUpload,
  onRemove,
  onAnnotate,
  disabled,
  uploading,
  showBeforeTag,
}: {
  slotKey: string;
  label: string;
  photoId: string;
  slotAnnotations: string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onAnnotate: () => void;
  disabled?: boolean;
  uploading?: boolean;
  showBeforeTag?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-full">
        {photoId ? (
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 shadow-sm">
            {slotAnnotations ? (
              <div
                className="w-full h-full cursor-pointer"
                onClick={!disabled ? onAnnotate : undefined}
              >
                <PhotoAnnotationRenderer
                  photoUrl={`/api/photos/${photoId}`}
                  annotations={slotAnnotations}
                  className="w-full h-full [&_canvas]:w-full [&_canvas]:h-full [&_canvas]:object-cover [&_canvas]:rounded-none"
                />
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`/api/photos/${photoId}`}
                alt={label}
                className="w-full h-full object-cover cursor-pointer"
                onClick={!disabled ? onAnnotate : undefined}
              />
            )}
            {showBeforeTag && (
              <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-600 text-white rounded">
                Before
              </span>
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
      <span className="text-[11px] font-semibold text-gray-500 tracking-wide">
        {label}
      </span>
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

function AddPhotoModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (file: File, label: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (f: File) => {
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleSubmit = () => {
    if (!file || !label.trim()) return;
    onSubmit(file, label.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Add Photo</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Label input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Close-up, Post-treatment"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            autoFocus
          />
        </div>

        {/* Upload area */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
          {preview ? (
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-gray-200 bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                }}
                className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-purple-400 hover:text-purple-500 hover:bg-purple-50/30 transition-all"
            >
              <CameraIcon className="size-10" />
              <span className="text-sm font-medium">Click to select photo</span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileChange(f);
              e.target.value = "";
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!file || !label.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UploadIcon className="size-4" />
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}

export function SmartPhotoGallery({
  photos,
  annotations,
  onUpload,
  onRemove,
  onAnnotate,
  disabled,
  uploading,
  extraPhotos,
  onAddExtraPhoto,
  onRemoveExtraPhoto,
  onAnnotateExtraPhoto,
}: SmartPhotoGalleryProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CameraIcon className="size-4 text-gray-600" />
          <h2 className="text-sm font-semibold text-gray-900">
            Smart Photo Gallery
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ImageIcon className="size-3.5" />
            View Previous
          </button>
          {!disabled && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            >
              + Add More Photos
            </button>
          )}
        </div>
      </div>

      {/* Standard Photo Grid */}
      <div className="grid grid-cols-4 gap-4">
        {PHOTO_SLOTS.map((slot) => (
          <PhotoSlot
            key={slot.key}
            slotKey={slot.key}
            label={slot.label}
            photoId={photos[slot.key] ?? ""}
            slotAnnotations={annotations[slot.key] ?? null}
            onUpload={(f) => onUpload(slot.key, f)}
            onRemove={() => onRemove(slot.key)}
            onAnnotate={() => onAnnotate(slot.key)}
            disabled={disabled}
            uploading={uploading === slot.key}
            showBeforeTag={slot.key === "frontal" && !!photos[slot.key]}
          />
        ))}
      </div>

      {/* Extra Photos */}
      {extraPhotos.length > 0 && (
        <div className="border-t border-gray-200 pt-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Additional Photos
          </h3>
          <div className="grid grid-cols-4 gap-4">
            {extraPhotos.map((photo) => (
              <PhotoSlot
                key={photo.id}
                slotKey={photo.id}
                label={photo.label}
                photoId={photo.id}
                slotAnnotations={photo.annotations}
                onUpload={() => {}}
                onRemove={() => onRemoveExtraPhoto(photo.id)}
                onAnnotate={() => onAnnotateExtraPhoto(photo.id)}
                disabled={disabled}
                uploading={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add Photo Modal */}
      {showAddModal && (
        <AddPhotoModal
          onSubmit={onAddExtraPhoto}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
