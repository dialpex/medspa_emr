"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Camera } from "lucide-react";
import type { PatientTimeline } from "@/lib/actions/patients";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PhotoLightbox({
  photo,
  photos,
  onClose,
  onNavigate,
}: {
  photo: PatientTimeline["photos"][number];
  photos: PatientTimeline["photos"];
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

export function PatientPhotos({
  photos,
}: {
  photos: PatientTimeline["photos"];
}) {
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
  const lightboxPhoto = lightboxPhotoId
    ? photos.find((p) => p.id === lightboxPhotoId)
    : null;

  if (photos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Camera className="size-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No photos yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photo) => (
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
              {formatDate(photo.createdAt)} · {photo.takenBy.name}
            </div>
          </div>
        ))}
      </div>

      {lightboxPhoto && (
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
