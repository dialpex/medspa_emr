"use client";

import { useState, useRef } from "react";
import { UploadIcon, Loader2Icon } from "lucide-react";

interface PhotoUploadProps {
  chartId: string;
  patientId: string;
  onUploaded: () => void;
}

export function PhotoUpload({ chartId, patientId, onUploaded }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("before");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("patientId", patientId);
      formData.append("chartId", chartId);
      formData.append("category", category);

      await fetch("/api/photos/upload", { method: "POST", body: formData });
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    onUploaded();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="before">Before</option>
          <option value="after">After</option>
          <option value="progress">Progress</option>
        </select>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <UploadIcon className="size-4" />
          )}
          {uploading ? "Uploading..." : "Upload Photos"}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleFiles(e.dataTransfer.files);
        }}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-500 hover:border-purple-400 transition-colors"
      >
        Drag & drop photos here, or click upload above
      </div>
    </div>
  );
}
