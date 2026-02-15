"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UploadIcon, XIcon, FileIcon, Loader2Icon, CheckCircleIcon, AlertCircleIcon } from "lucide-react";

type ImportState = "idle" | "uploading" | "processing" | "done" | "error";

const ACCEPTED_TYPES = ".pdf,.txt,.docx,.png,.jpg,.jpeg";
const ACCEPTED_MIME = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
];

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>("idle");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setState("idle");
    setFileName("");
    setError("");
    setDragOver(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_MIME.includes(file.type) && !file.name.match(/\.(pdf|txt|docx|png|jpe?g)$/i)) {
      setError("Unsupported file type. Please upload a PDF, TXT, DOCX, PNG, or JPG file.");
      setState("error");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds 10MB limit.");
      setState("error");
      return;
    }

    setFileName(file.name);
    setState("uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setState("processing");

      const response = await fetch("/api/templates/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Import failed");
      }

      const result = await response.json();
      setState("done");

      // Encode fields and redirect to new template form
      const fieldsData = {
        fields: result.fields,
        name: result.suggestedName,
        type: result.suggestedType,
        category: result.suggestedCategory,
      };
      const encoded = Buffer.from(JSON.stringify(fieldsData)).toString("base64");

      setTimeout(() => {
        handleClose();
        router.push(`/settings/templates/new?import=${encoded}`);
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setState("error");
    }
  }, [router]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <p className="text-xs font-medium text-purple-600 uppercase tracking-wide">Import</p>
            <h2 className="text-lg font-semibold text-gray-900">Import Template</h2>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {state === "idle" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-purple-400 bg-purple-50"
                  : "border-gray-300 hover:border-purple-300 hover:bg-purple-50/30"
              }`}
            >
              <UploadIcon className="size-8 mx-auto text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">
                Drop your file here or click to browse
              </p>
              <p className="text-xs text-gray-500">
                Supports PDF, TXT, DOCX, PNG, JPG (max 10MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {(state === "uploading" || state === "processing") && (
            <div className="text-center py-8">
              <Loader2Icon className="size-8 mx-auto text-purple-600 animate-spin mb-3" />
              <div className="flex items-center justify-center gap-2 mb-2">
                <FileIcon className="size-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">{fileName}</span>
              </div>
              <p className="text-sm text-gray-500">
                {state === "uploading" ? "Uploading..." : "AI is analyzing your document..."}
              </p>
            </div>
          )}

          {state === "done" && (
            <div className="text-center py-8">
              <CheckCircleIcon className="size-8 mx-auto text-green-500 mb-3" />
              <p className="text-sm font-medium text-gray-700">Template extracted successfully!</p>
              <p className="text-xs text-gray-500 mt-1">Redirecting to template editor...</p>
            </div>
          )}

          {state === "error" && (
            <div className="text-center py-8">
              <AlertCircleIcon className="size-8 mx-auto text-red-500 mb-3" />
              <p className="text-sm font-medium text-red-700 mb-2">{error}</p>
              <button
                onClick={reset}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
