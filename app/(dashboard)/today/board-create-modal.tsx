"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { createBoardEntry } from "@/lib/actions/board";

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

function extractMentionedUserIds(
  content: string,
  users: { id: string; name: string }[]
): string[] {
  const ids: string[] = [];
  for (const user of users) {
    if (content.includes(`@${user.name}`)) {
      ids.push(user.id);
    }
  }
  return ids;
}

export function BoardCreateModal({
  users,
  onClose,
}: {
  users: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("normal");
  const [category, setCategory] = useState("general");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("daily");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(0);
  const mentionListRef = useRef<HTMLUListElement>(null);

  const filteredUsers =
    mentionQuery !== null
      ? users.filter((u) =>
          u.name.toLowerCase().includes(mentionQuery.toLowerCase())
        )
      : [];

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Reset mention index when filtered list changes
  useEffect(() => {
    setMentionIndex(0);
  }, [mentionQuery]);

  const closeMention = useCallback(() => {
    setMentionQuery(null);
    setMentionIndex(0);
  }, []);

  function insertMention(user: { id: string; name: string }) {
    const before = content.slice(0, mentionStart);
    const after = content.slice(
      textareaRef.current?.selectionStart ?? content.length
    );
    const newContent = `${before}@${user.name} ${after}`;
    setContent(newContent.slice(0, 500));
    closeMention();

    // Move cursor after the inserted mention
    requestAnimationFrame(() => {
      const pos = mentionStart + user.name.length + 2; // @name + space
      textareaRef.current?.setSelectionRange(pos, pos);
      textareaRef.current?.focus();
    });
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value.slice(0, 500);
    setContent(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);

    // Find the last @ that isn't preceded by a word character
    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex >= 0 && (atIndex === 0 || /\s/.test(textBeforeCursor[atIndex - 1]))) {
      const query = textBeforeCursor.slice(atIndex + 1);
      // Only show if no space that would break the mention (allow spaces within names)
      if (!query.includes("\n")) {
        setMentionQuery(query);
        setMentionStart(atIndex);
        return;
      }
    }
    closeMention();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Mention dropdown is open — handle navigation
    if (mentionQuery !== null && filteredUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredUsers.length);
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filteredUsers.length) % filteredUsers.length);
        return;
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredUsers[mentionIndex]);
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeMention();
        return;
      }
    }

    // Enter (without shift) submits the form
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const handleSubmit = () => {
    if (!content.trim()) return;
    const mentionedIds = extractMentionedUserIds(content, users);
    startTransition(async () => {
      const result = await createBoardEntry({
        content: content.trim(),
        type: "task",
        priority,
        category,
        assignedToId: null,
        mentions: mentionedIds.length > 0 ? JSON.stringify(mentionedIds) : null,
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

      {/* Content with @mention */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay close so click on mention item registers first
            setTimeout(() => closeMention(), 150);
          }}
          placeholder="What needs to happen? Type @ to mention someone"
          rows={2}
          className="w-full resize-none border-b border-gray-200 focus:border-purple-500 bg-transparent text-sm text-gray-800 placeholder:text-gray-300 outline-none pb-2 mb-1"
        />

        {/* Mention dropdown */}
        {mentionQuery !== null && filteredUsers.length > 0 && (
          <ul
            ref={mentionListRef}
            className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg max-h-36 overflow-y-auto z-20"
          >
            {filteredUsers.map((u, i) => (
              <li key={u.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent textarea blur
                    insertMention(u);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm ${
                    i === mentionIndex
                      ? "bg-purple-50 text-purple-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {u.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="text-right mb-3">
        <span className={`text-[10px] ${content.length > 450 ? "text-amber-500" : "text-gray-300"}`}>
          {content.length}/500
        </span>
      </div>

      {/* Priority + Category + Recurring row */}
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
