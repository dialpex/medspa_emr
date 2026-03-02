"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Camera, ArrowLeft, GitCompareArrows } from "lucide-react";
import type { PatientTimeline } from "@/lib/actions/patients";
import { ImageComparison } from "@/components/imaging/ImageComparison";
import { cn } from "@/lib/utils";

type Photo = PatientTimeline["photos"][number];

interface VisitGroup {
  key: string;
  label: string;
  date: Date | null;
  photos: Photo[];
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatHeadingDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();
}

function groupByVisit(photos: Photo[]): VisitGroup[] {
  const groups = new Map<string, VisitGroup>();

  for (const photo of photos) {
    const appt = photo.chart?.appointment;
    if (appt) {
      const key = appt.id;
      if (!groups.has(key)) {
        const dateStr = formatHeadingDate(appt.startTime);
        const service = appt.service?.name;
        groups.set(key, {
          key,
          label: service ? `${dateStr} — ${service}` : dateStr,
          date: new Date(appt.startTime),
          photos: [],
        });
      }
      groups.get(key)!.photos.push(photo);
    } else {
      const key = "standalone";
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: "Other Photos",
          date: null,
          photos: [],
        });
      }
      groups.get(key)!.photos.push(photo);
    }
  }

  const sorted = Array.from(groups.values()).sort((a, b) => {
    if (a.key === "standalone") return 1;
    if (b.key === "standalone") return -1;
    return (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0);
  });

  return sorted;
}

function PhotoLightbox({
  photo,
  photos,
  onClose,
  onNavigate,
}: {
  photo: Photo;
  photos: Photo[];
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const currentIndex = photos.findIndex((p) => p.id === photo.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return createPortal(
    <div
      id="photo-lightbox"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,1)",
      }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 1,
          width: 40,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          background: "rgba(0,0,0,0.5)",
          color: "white",
          border: "none",
          cursor: "pointer",
          fontSize: 24,
        }}
      >
        &times;
      </button>

      {hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(photos[currentIndex - 1].id);
          }}
          style={{
            position: "absolute",
            left: 16,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 1,
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            background: "rgba(0,0,0,0.5)",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontSize: 24,
          }}
        >
          &#8249;
        </button>
      )}

      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(photos[currentIndex + 1].id);
          }}
          style={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 1,
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            background: "rgba(0,0,0,0.5)",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontSize: 24,
          }}
        >
          &#8250;
        </button>
      )}

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

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: 24,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "white",
        }}
      >
        <div style={{ fontSize: 14 }}>
          {photo.category && (
            <span
              style={{
                padding: "2px 8px",
                fontSize: 12,
                borderRadius: 9999,
                background: "rgba(255,255,255,0.2)",
                marginRight: 8,
              }}
            >
              {photo.category}
            </span>
          )}
          {photo.caption && <span style={{ opacity: 0.8 }}>{photo.caption}</span>}
        </div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
          {formatDate(photo.createdAt)} · {photo.takenBy.name} · {currentIndex + 1} of{" "}
          {photos.length}
        </div>
      </div>
    </div>,
    document.body
  );
}

function getPhotoDate(photo: Photo): Date {
  return new Date(photo.chart?.appointment?.startTime ?? photo.createdAt);
}

function getPhotoDateLabel(photo: Photo): string {
  const appt = photo.chart?.appointment;
  return formatDate(appt?.startTime ?? photo.createdAt);
}

export function PatientPhotos({
  photos,
}: {
  photos: PatientTimeline["photos"];
}) {
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<[string | null, string | null]>([null, null]);
  const [showComparison, setShowComparison] = useState(false);

  const lightboxPhoto = lightboxPhotoId
    ? photos.find((p) => p.id === lightboxPhotoId)
    : null;

  const visitGroups = useMemo(() => groupByVisit(photos), [photos]);

  const selectedPhotos = useMemo(() => {
    const first = selectedIds[0] ? photos.find((p) => p.id === selectedIds[0]) : null;
    const second = selectedIds[1] ? photos.find((p) => p.id === selectedIds[1]) : null;
    if (!first || !second) return null;

    const d1 = getPhotoDate(first);
    const d2 = getPhotoDate(second);
    const before = d1 <= d2 ? first : second;
    const after = d1 <= d2 ? second : first;
    return { before, after };
  }, [selectedIds, photos]);

  function handlePhotoClick(photoId: string) {
    if (!compareMode) {
      setLightboxPhotoId(photoId);
      return;
    }

    // Toggle selection
    if (selectedIds[0] === photoId) {
      setSelectedIds([selectedIds[1], null]);
    } else if (selectedIds[1] === photoId) {
      setSelectedIds([selectedIds[0], null]);
    } else if (selectedIds[0] === null) {
      setSelectedIds([photoId, selectedIds[1]]);
    } else if (selectedIds[1] === null) {
      setSelectedIds([selectedIds[0], photoId]);
    } else {
      // Both slots filled, replace the second
      setSelectedIds([selectedIds[0], photoId]);
    }
  }

  function getSelectionIndex(photoId: string): number | null {
    if (selectedIds[0] === photoId) return 1;
    if (selectedIds[1] === photoId) return 2;
    return null;
  }

  function exitCompareMode() {
    setCompareMode(false);
    setSelectedIds([null, null]);
    setShowComparison(false);
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Camera className="size-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No photos yet</p>
      </div>
    );
  }

  // Comparison view
  if (showComparison && selectedPhotos) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setShowComparison(false)}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Photos
        </button>
        <ImageComparison
          before={{
            src: `/api/photos/${selectedPhotos.before.id}`,
            label: getPhotoDateLabel(selectedPhotos.before),
          }}
          after={{
            src: `/api/photos/${selectedPhotos.after.id}`,
            label: getPhotoDateLabel(selectedPhotos.after),
          }}
          defaultMode="side-by-side"
        />
      </div>
    );
  }

  const bothSelected = selectedIds[0] !== null && selectedIds[1] !== null;

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {photos.length} photo{photos.length !== 1 ? "s" : ""}
        </p>
        {photos.length >= 2 && (
          <button
            onClick={() => {
              if (compareMode) {
                exitCompareMode();
              } else {
                setCompareMode(true);
              }
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
              compareMode
                ? "bg-purple-100 text-purple-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <GitCompareArrows className="size-4" />
            Compare
          </button>
        )}
      </div>

      {compareMode && (
        <div className="mb-4 inline-block rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs text-purple-700">
          Select 2 photos to compare
        </div>
      )}

      {/* Photo grid grouped by visit */}
      <div className="space-y-6">
        {visitGroups.map((group) => (
          <div key={group.key}>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wide mb-3 pb-2 border-b border-gray-200">
              {group.label}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {group.photos.map((photo) => {
                const selIndex = compareMode ? getSelectionIndex(photo.id) : null;
                return (
                  <div
                    key={photo.id}
                    className="cursor-pointer group"
                    onClick={() => handlePhotoClick(photo.id)}
                  >
                    <div
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden bg-gray-100 ring-1 ring-gray-200 transition-all",
                        compareMode && selIndex
                          ? "ring-2 ring-purple-500"
                          : "group-hover:ring-purple-300"
                      )}
                    >
                      <img
                        src={`/api/photos/${photo.id}`}
                        alt={photo.caption || photo.category || "Patient photo"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                      {photo.category && !selIndex && (
                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-black/60 text-white">
                          {photo.category}
                        </span>
                      )}
                      {selIndex && (
                        <span className="absolute top-1.5 left-1.5 flex items-center justify-center size-6 rounded-full bg-purple-600 text-white text-xs font-bold">
                          {selIndex}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 truncate">
                      {formatDate(photo.createdAt)} · {photo.takenBy.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky comparison bar */}
      {compareMode && bothSelected && selectedPhotos && (
        <div className="sticky bottom-0 mt-6 flex justify-center pb-1">
          <div className="inline-flex items-center gap-3 rounded-xl border border-purple-200 bg-white px-4 py-3 shadow-lg">
            <span className="text-sm text-gray-700">
              Ready to compare ({getPhotoDateLabel(selectedPhotos.before)} vs{" "}
              {getPhotoDateLabel(selectedPhotos.after)})
            </span>
            <button
              onClick={() => setShowComparison(true)}
              className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              Compare Now
            </button>
          </div>
        </div>
      )}

      {/* Lightbox (normal mode only) */}
      {!compareMode && lightboxPhoto && (
        <PhotoLightbox
          photo={lightboxPhoto}
          photos={photos}
          onClose={() => setLightboxPhotoId(null)}
          onNavigate={(id) => setLightboxPhotoId(id)}
        />
      )}
    </>
  );
}
