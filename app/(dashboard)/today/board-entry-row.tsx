"use client";

import { useState, useTransition } from "react";
import { Trash2, RefreshCw } from "lucide-react";
import { toggleBoardEntry, deleteBoardEntry } from "@/lib/actions/board";
import type { BoardEntryView } from "@/lib/actions/board";

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-gray-100 text-gray-600",
  clinical: "bg-blue-50 text-blue-600",
  admin: "bg-purple-50 text-purple-600",
  handoff: "bg-amber-50 text-amber-600",
};

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function renderContentWithMentions(
  content: string,
  users: { id: string; name: string }[]
) {
  const parts = content.split(/(@\w[\w\s]*?)(?=\s@|\s|$)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const mentionName = part.slice(1).trim();
      const isUser = users.some(
        (u) =>
          u.name.toLowerCase().includes(mentionName.toLowerCase()) ||
          mentionName.toLowerCase().includes(u.name.split(" ")[0].toLowerCase())
      );
      if (isUser) {
        return (
          <span
            key={i}
            className="bg-blue-100 text-blue-700 rounded px-1 text-xs font-medium"
          >
            {part}
          </span>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

export function BoardEntryRow({
  entry,
  users,
  canWrite,
}: {
  entry: BoardEntryView;
  users: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimisticCompleted, setOptimisticCompleted] = useState(entry.isCompleted);

  const handleToggle = () => {
    if (!canWrite) return;
    setOptimisticCompleted(!optimisticCompleted);
    startTransition(async () => {
      const result = await toggleBoardEntry(entry.id);
      if (!result.success) {
        setOptimisticCompleted(entry.isCompleted);
      }
    });
  };

  const handleDelete = () => {
    if (!canWrite) return;
    startTransition(async () => {
      await deleteBoardEntry(entry.id);
    });
  };

  const isUrgent = entry.priority === "urgent" && !optimisticCompleted;
  const categoryClass = CATEGORY_COLORS[entry.category ?? "general"] ?? CATEGORY_COLORS.general;

  return (
    <div
      className={`group flex items-start gap-2.5 py-2 px-2 rounded-lg transition-all ${
        isUrgent ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-gray-50"
      } ${optimisticCompleted ? "opacity-50" : ""} ${isPending ? "pointer-events-none" : ""}`}
    >
      {/* Checkbox */}
      {canWrite ? (
        <button
          onClick={handleToggle}
          className={`mt-1 flex-shrink-0 h-4 w-4 rounded-full border-[1.5px] transition-colors flex items-center justify-center ${
            optimisticCompleted
              ? "bg-purple-500 border-purple-500"
              : "border-gray-300 hover:border-purple-400"
          }`}
        >
          {optimisticCompleted && (
            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      ) : (
        <div
          className={`mt-1 flex-shrink-0 h-4 w-4 rounded-full border-[1.5px] ${
            optimisticCompleted ? "bg-purple-500 border-purple-500" : "border-gray-300"
          }`}
        />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-snug flex items-center gap-1.5 ${
            optimisticCompleted
              ? "line-through text-gray-400"
              : "text-gray-800"
          }`}
        >
          {isUrgent && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          )}
          <span>{renderContentWithMentions(entry.content, users)}</span>
          {entry.isRecurring && (
            <RefreshCw className="inline ml-1 h-3 w-3 text-gray-400" />
          )}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] text-gray-400 font-medium">
            {getInitials(entry.createdByName)}
          </span>
          <span className="text-[10px] text-gray-300">&middot;</span>
          <span className="text-[10px] text-gray-400">
            {timeAgo(entry.createdAt)}
          </span>
          {entry.category && (
            <>
              <span className="text-[10px] text-gray-300">&middot;</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryClass}`}
              >
                {entry.category}
              </span>
            </>
          )}
          {entry.assignedToName && (
            <>
              <span className="text-[10px] text-gray-300">&middot;</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                {entry.assignedToName.split(" ")[0]}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Delete */}
      {canWrite && (
        <button
          onClick={handleDelete}
          className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
