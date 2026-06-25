"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { BoardEntryView } from "@/lib/actions/board";
import { BoardEntryRow } from "./board-entry-row";
import { BoardCreateModal } from "./board-create-modal";

type Filter = "all" | "mine" | "urgent";

export function BoardWidgetClient({
  entries,
  users,
  currentUserId,
  canWrite,
}: {
  entries: BoardEntryView[];
  users: { id: string; name: string }[];
  currentUserId: string;
  canWrite: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = entries.filter((e) => {
    if (filter === "urgent") return e.priority === "urgent";
    if (filter === "mine") {
      if (e.assignedToId === currentUserId) return true;
      if (e.createdById === currentUserId) return true;
      if (e.mentions) {
        try {
          const ids = JSON.parse(e.mentions) as string[];
          if (ids.includes(currentUserId)) return true;
        } catch { /* ignore */ }
      }
      return false;
    }
    return true;
  });

  const activeCount = entries.filter((e) => !e.isCompleted).length;

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "mine", label: "Mine" },
    { key: "urgent", label: "Urgent" },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-h-[340px] flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Team Board
          </p>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-semibold">
              {activeCount}
            </span>
          )}
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center h-7 w-7 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-3">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              filter === f.key
                ? "bg-purple-50 text-purple-700"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-sm text-gray-300">
              {filter === "all"
                ? "No entries yet — post the first one!"
                : `No ${filter} entries`}
            </p>
          </div>
        ) : (
          filtered.map((entry) => (
            <BoardEntryRow
              key={entry.id}
              entry={entry}
              users={users}
              canWrite={canWrite}
            />
          ))
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <BoardCreateModal
          users={users}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
