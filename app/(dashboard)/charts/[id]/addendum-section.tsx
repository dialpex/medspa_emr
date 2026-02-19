"use client";

import { useState } from "react";
import { PlusIcon, ClockIcon, UserIcon } from "lucide-react";

interface AddendumEntry {
  id: string;
  text: string;
  createdAt: string;
  authorName: string;
}

interface AddendumSectionProps {
  encounterId: string;
  initialAddenda: AddendumEntry[];
  canAddAddendum: boolean;
}

export function AddendumSection({
  encounterId,
  initialAddenda,
  canAddAddendum,
}: AddendumSectionProps) {
  const [addenda, setAddenda] = useState<AddendumEntry[]>(initialAddenda);
  const [showModal, setShowModal] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/encounters/${encounterId}/addendum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const data = await res.json();
      if (data.success && data.addendum) {
        setAddenda((prev) => [...prev, data.addendum]);
        setText("");
        setShowModal(false);
        setToast("Addendum recorded.");
        setTimeout(() => setToast(null), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Addenda</h2>
        {canAddAddendum && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 border border-purple-200"
          >
            <PlusIcon className="size-3.5" />
            Add Addendum
          </button>
        )}
      </div>

      {addenda.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No addenda recorded.</p>
      ) : (
        <div className="space-y-0 divide-y divide-gray-100">
          {addenda.map((entry) => (
            <div key={entry.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <ClockIcon className="size-3" />
                  {new Date(entry.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <UserIcon className="size-3" />
                  {entry.authorName}
                </span>
              </div>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                {entry.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add Addendum
            </h3>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter addendum text..."
              rows={5}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowModal(false);
                  setText("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !text.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}
    </div>
  );
}
