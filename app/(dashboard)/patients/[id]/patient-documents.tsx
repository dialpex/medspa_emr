"use client";

import { useState, useRef } from "react";
import { FolderOpen, Upload, Loader2, X, Trash2 } from "lucide-react";
import type { PatientTimeline } from "@/lib/actions/patients";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"];

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Document = PatientTimeline["documents"][number];

export function PatientDocuments({
  patientId,
  documents: initialDocuments,
  canUpload,
  canDelete,
}: {
  patientId: string;
  documents: PatientTimeline["documents"];
  canUpload: boolean;
  canDelete: boolean;
}) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setError(null);

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError("Only PDF and image files are allowed.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("File must be under 20 MB.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("patientId", patientId);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Upload failed");
      }

      const { document } = await res.json();
      // Append new doc to local state so it appears immediately
      setDocuments((prev) => [
        {
          id: document.id,
          filename: document.filename,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
          category: document.category,
          notes: document.notes,
          createdAt: new Date(document.createdAt),
          uploadedBy: { name: "You" },
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(docId: string, filename: string) {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;

    setDeletingId(docId);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Delete failed");
      }
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const isEmpty = documents.length === 0 && !uploading;

  return (
    <div>
      {/* Header with upload button */}
      {canUpload && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </p>
          <label
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all cursor-pointer
              ${uploading ? "bg-gray-100 text-gray-400" : "text-gray-600 hover:bg-gray-100"}`}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {uploading ? "Uploading..." : "Upload"}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
          </label>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}

      {isEmpty ? (
        <div className="text-center py-12 text-gray-500">
          <FolderOpen className="size-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No documents yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex justify-between items-start p-3 bg-gray-50 rounded-lg"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{doc.filename}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {doc.category && <span className="capitalize">{doc.category} · </span>}
                  {formatDate(doc.createdAt)} · {doc.uploadedBy.name}
                  {doc.sizeBytes > 0 && <span> · {formatFileSize(doc.sizeBytes)}</span>}
                </div>
                {doc.notes && (
                  <div className="text-xs text-gray-400 mt-1">{doc.notes}</div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <a
                  href={`/api/documents/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 text-xs rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  View
                </a>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(doc.id, doc.filename)}
                    disabled={deletingId === doc.id}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Delete document"
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
