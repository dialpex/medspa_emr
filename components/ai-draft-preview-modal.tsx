"use client";

import { useState } from "react";
import { XIcon, CheckIcon, AlertTriangleIcon, AlertCircleIcon, InfoIcon, Loader2Icon, ChevronDownIcon } from "lucide-react";

interface AiDraftData {
  draftEventId: string;
  structuredPatch: Record<string, unknown>;
  narrativeDraftText: string;
  missingHighRisk: Array<{ field: string; reason: string }>;
  conflicts: Array<{ field: string; existing: unknown; proposed: unknown }>;
  warnings: string[];
  transcriptText?: string;
}

interface AiDraftPreviewModalProps {
  draft: AiDraftData;
  currentNarrative: string;
  onApply: (result: { updatedStructuredData: Record<string, unknown>; updatedNarrativeText: string }) => void;
  onDiscard: () => void;
}

export function AiDraftPreviewModal({
  draft,
  currentNarrative,
  onApply,
  onDiscard,
}: AiDraftPreviewModalProps) {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const patchEntries = Object.entries(draft.structuredPatch).filter(
    ([, value]) => value !== undefined && value !== null && value !== "" && value !== 0
  );

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-drafts/${draft.draftEventId}/apply`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to apply draft");
        setApplying(false);
        return;
      }
      onApply({
        updatedStructuredData: data.updatedStructuredData,
        updatedNarrativeText: data.updatedNarrativeText,
      });
    } catch {
      setError("Network error");
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onDiscard} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">AI Draft Preview</h2>
          <button
            onClick={onDiscard}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Transcript (voice drafts only) */}
          {draft.transcriptText && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setTranscriptOpen(!transcriptOpen)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <span>Voice Transcript</span>
                <ChevronDownIcon className={`size-4 transition-transform ${transcriptOpen ? "rotate-180" : ""}`} />
              </button>
              {transcriptOpen && (
                <div className="px-3 py-2 text-sm text-gray-600 bg-white border-t border-gray-100 whitespace-pre-wrap">
                  {draft.transcriptText}
                </div>
              )}
            </div>
          )}

          {/* Narrative comparison */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Narrative</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs font-medium text-gray-500 mb-1 block">Current</span>
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 min-h-[80px] whitespace-pre-wrap">
                  {currentNarrative || <span className="text-gray-400 italic">Empty</span>}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-green-600 mb-1 block">AI Draft</span>
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-gray-700 min-h-[80px] whitespace-pre-wrap">
                  {draft.narrativeDraftText}
                </div>
              </div>
            </div>
          </div>

          {/* Structured changes */}
          {patchEntries.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Structured Changes
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                  {patchEntries.length}
                </span>
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">Field</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500">Proposed Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {patchEntries.map(([field, value]) => (
                      <tr key={field}>
                        <td className="px-3 py-2 font-medium text-gray-700">{field}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {typeof value === "object" ? (
                            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                              {JSON.stringify(value, null, 2)}
                            </code>
                          ) : (
                            String(value)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Conflicts */}
          {draft.conflicts.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangleIcon className="size-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Existing values preserved</span>
              </div>
              <ul className="text-sm text-yellow-700 space-y-1 ml-5.5">
                {draft.conflicts.map((c) => (
                  <li key={c.field} className="list-disc ml-1">
                    <span className="font-medium">{c.field}</span>: keeping &ldquo;{String(c.existing)}&rdquo;
                    (proposed: &ldquo;{String(c.proposed)}&rdquo;)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing high-risk */}
          {draft.missingHighRisk.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertCircleIcon className="size-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">Missing high-risk fields</span>
              </div>
              <ul className="text-sm text-red-700 space-y-0.5 ml-5.5">
                {draft.missingHighRisk.map((m) => (
                  <li key={m.field} className="list-disc ml-1">
                    <span className="font-medium">{m.field}</span> — {m.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {draft.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1.5">
                <InfoIcon className="size-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Warnings</span>
              </div>
              <ul className="text-sm text-amber-700 space-y-0.5 ml-5.5">
                {draft.warnings.map((w, i) => (
                  <li key={i} className="list-disc ml-1">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onDiscard}
            disabled={applying}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Discard
          </button>
          <button
            onClick={handleApply}
            disabled={applying}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {applying ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <CheckIcon className="size-4" />
            )}
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
