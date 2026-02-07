"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, useCallback } from "react";
import { Search, MessageSquare } from "lucide-react";
import type { getConversations } from "@/lib/actions/messaging";

type Conversation = Awaited<ReturnType<typeof getConversations>>[number];

function formatRelativeTime(date: Date | null): string {
  if (!date) return "";
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export function ConversationList({
  conversations,
  activeId,
  search,
}: {
  conversations: Conversation[];
  activeId?: string;
  search?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(search || "");

  const handleSearch = useCallback(
    (value: string) => {
      setSearchValue(value);
      const timer = setTimeout(() => {
        startTransition(() => {
          const params = new URLSearchParams(searchParams.toString());
          if (value) {
            params.set("q", value);
          } else {
            params.delete("q");
          }
          router.push(`/inbox?${params.toString()}`);
        });
      }, 300);
      return () => clearTimeout(timer);
    },
    [router, searchParams, startTransition]
  );

  const handleSelect = (id: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("conversationId", id);
      router.push(`/inbox?${params.toString()}`);
    });
  };

  return (
    <div className="w-[380px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Messages</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search patients..."
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-300"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isPending && (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          </div>
        )}

        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <MessageSquare className="size-8 mb-2" />
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeId;
            const isOptedOut =
              !conv.patient.communicationPreference?.smsOptIn;

            return (
              <button
                key={conv.id}
                onClick={() => handleSelect(conv.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                  isActive
                    ? "bg-purple-50 border-l-2 border-l-purple-500"
                    : "hover:bg-gray-50 border-l-2 border-l-transparent"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 truncate">
                        {conv.patient.firstName} {conv.patient.lastName}
                      </span>
                      {isOptedOut && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          Opted Out
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {conv.patient.phone || "No phone"}
                    </p>
                    {conv.lastMessagePreview && (
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {conv.lastMessagePreview}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[10px] text-gray-400">
                      {formatRelativeTime(conv.lastMessageAt)}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-500 px-1 text-[10px] font-bold text-white">
                        {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
