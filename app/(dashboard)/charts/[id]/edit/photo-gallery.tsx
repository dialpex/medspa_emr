"use client";

import { useState } from "react";
import { PhotoAnnotator } from "@/components/photo-annotator";

type Photo = {
  id: string;
  filename: string;
  category: string | null;
  annotations: string | null;
  createdAt: Date;
};

const CATEGORY_LABELS: Record<string, string> = {
  before: "Before",
  after: "After",
  progress: "Progress",
};

export function PhotoGallery({
  photos,
  onRefresh,
}: {
  photos: Photo[];
  onRefresh: () => void;
}) {
  const [annotatingPhoto, setAnnotatingPhoto] = useState<Photo | null>(null);

  if (photos.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">
        No photos uploaded yet.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setAnnotatingPhoto(photo)}
            className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-purple-400 transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${photo.id}`}
              alt={photo.filename}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            {photo.category && (
              <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium bg-black/60 text-white rounded-full">
                {CATEGORY_LABELS[photo.category] ?? photo.category}
              </span>
            )}
            {photo.annotations && (
              <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium bg-purple-600 text-white rounded-full">
                Annotated
              </span>
            )}
          </button>
        ))}
      </div>

      {annotatingPhoto && (
        <PhotoAnnotator
          photoId={annotatingPhoto.id}
          photoUrl={`/api/photos/${annotatingPhoto.id}`}
          initialAnnotations={annotatingPhoto.annotations}
          onClose={() => {
            setAnnotatingPhoto(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
