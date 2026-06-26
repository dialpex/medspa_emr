"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { createBoardEntry } from "@/lib/actions/board";

const TYPES = [
  { key: "task", label: "Task" },
  { key: "note", label: "Note" },
  { key: "reminder", label: "Reminder" },
] as const;

const CATEGORIES = [
  { key: "general", label: "General" },
  { key: "clinical", label: "Clinical" },
  { key: "admin", label: "Admin" },
  { key: "handoff", label: "Handoff" },
] as const;

const RECURRENCE_RULES = [
  { key: "daily", label: "Daily" },
  { key: "weekdays", label: "Weekdays" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
] as const;

export function BoardCreateModal({
  users,
  onClose,
}: {
  users: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [type, setType] = useState("task");
  const [priority, setPriority] = useState("normal");
  const [category, setCategory] = useState("general");
  const [assignedToId, setAssignedToId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("daily");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!content.trim()) return;
    startTransition(async () => {
      const result = await createBoardEntry({
        content: content.trim(),
        type,
        priority,
        category,
        assignedToId: assignedToId || null,
        isRecurring,
        recurrenceRule: isRecurring ? recurrenceRule : null,
      });
      if (result.success) {
        onClose();
      }
    });
  };

  return (
    <div className="absolute inset-x-0 bottom-0 bg-white border-t border-gray-200 rounded-b-xl p-4 shadow-lg z-10 animate-in slide-in-from-bottom duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          New Entry
        </span>
        <button
          onClick={onClose}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, 500))}
        placeholder="What needs to happen?"
        rows={2}
        className="w-full resize-none border-b border-gray-200 focus:border-purple-500 bg-transparent text-sm text-gray-800 placeholder:text-gray-300 outline-none pb-2 mb-1"
      />
      <div className="text-right mb-3">
        <span className={`text-[10px] ${content.length > 450 ? "text-amber-500" : "text-gray-300"}`}>
          {content.length}/500
        </span>
      </div>

      {/* Type segmented control */}
      <div className="flex gap-1 mb-3">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-colors ${
              type === t.key
                ? "bg-purple-50 text-purple-700"
                : "text-gray-400 hover:text-gray-600 bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Priority + Category row */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setPriority(priority === "normal" ? "urgent" : "normal")}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
            priority === "urgent"
              ? "bg-red-50 text-red-600"
              : "bg-gray-50 text-gray-400 hover:text-gray-600"
          }`}
        >
          {priority === "urgent" ? "Urgent" : "Normal"}
        </button>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex-1 px-2 py-1 rounded-md text-[11px] bg-gray-50 text-gray-600 border-0 outline-none cursor-pointer"
        >
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Assign + Recurring row */}
      <div className="flex gap-2 mb-3">
        <select
          value={assignedToId}
          onChange={(e) => setAssignedToId(e.target.value)}
          className="flex-1 px-2 py-1 rounded-md text-[11px] bg-gray-50 text-gray-600 border-0 outline-none cursor-pointer"
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setIsRecurring(!isRecurring)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
            isRecurring
              ? "bg-blue-50 text-blue-600"
              : "bg-gray-50 text-gray-400 hover:text-gray-600"
          }`}
        >
          Recurring
        </button>
      </div>

      {/* Recurrence rule (visible only when recurring is on) */}
      {isRecurring && (
        <div className="flex gap-1 mb-3">
          {RECURRENCE_RULES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRecurrenceRule(r.key)}
              className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-colors ${
                recurrenceRule === r.key
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-400 hover:text-gray-600 bg-gray-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={isPending || !content.trim()}
        className="w-full py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? "Posting..." : "Post"}
      </button>
    </div>
  );
}
