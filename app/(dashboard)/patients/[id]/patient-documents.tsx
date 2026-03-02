"use client";

import { FolderOpen } from "lucide-react";
import type { PatientTimeline } from "@/lib/actions/patients";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PatientDocuments({
  documents,
}: {
  documents: PatientTimeline["documents"];
}) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FolderOpen className="size-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No documents yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex justify-between items-start p-3 bg-gray-50 rounded-lg"
        >
          <div>
            <div className="font-medium text-sm">{doc.filename}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {doc.category && <span className="capitalize">{doc.category} · </span>}
              {formatDate(doc.createdAt)} · {doc.uploadedBy.name}
            </div>
            {doc.notes && (
              <div className="text-xs text-gray-400 mt-1">{doc.notes}</div>
            )}
          </div>
          <a
            href={`/api/documents/${doc.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 px-2.5 py-1 text-xs rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            View
          </a>
        </div>
      ))}
    </div>
  );
}
