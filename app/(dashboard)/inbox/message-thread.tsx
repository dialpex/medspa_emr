"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MessageSquare,
  Check,
  CheckCheck,
  AlertCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { MessageComposer } from "./message-composer";
import { retryMessageAction } from "@/lib/actions/messaging";
import type { Message, MessageTemplate, MessagePurpose } from "@prisma/client";
import type { getConversations } from "@/lib/actions/messaging";

type Conversation = Awaited<ReturnType<typeof getConversations>>[number];

const PURPOSE_LABELS: Record<string, string> = {
  AppointmentConfirmation: "Confirmation",
  Reminder: "Reminder",
  Arrival: "Arrival",
  FollowUp: "Follow Up",
  Generic: "Generic",
};

const PURPOSE_COLORS: Record<string, string> = {
  AppointmentConfirmation: "bg-green-500/20 text-green-200",
  Reminder: "bg-blue-500/20 text-blue-200",
  Arrival: "bg-amber-500/20 text-amber-200",
  FollowUp: "bg-purple-500/20 text-purple-200",
  Generic: "bg-white/20 text-white/70",
};

const PURPOSE_COLORS_INBOUND: Record<string, string> = {
  AppointmentConfirmation: "bg-green-100 text-green-700",
  Reminder: "bg-blue-100 text-blue-700",
  Arrival: "bg-amber-100 text-amber-700",
  FollowUp: "bg-purple-100 text-purple-700",
  Generic: "bg-gray-200 text-gray-600",
};

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "Queued":
      return <Loader2 className="size-3 animate-spin text-white/60" />;
    case "Sent":
      return <Check className="size-3 text-white/60" />;
    case "Delivered":
      return <CheckCheck className="size-3 text-white/60" />;
    case "Failed":
      return <AlertCircle className="size-3 text-red-300" />;
    default:
      return null;
  }
}

interface OptimisticMessage {
  id: string;
  body: string;
  purpose: MessagePurpose;
  status: "sending";
  createdAt: Date;
}

export function MessageThread({
  conversation,
  messages,
  permissions,
  templates,
}: {
  conversation: Conversation | null;
  messages: Message[];
  permissions: { canView: boolean; canSend: boolean };
  templates: MessageTemplate[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<
    OptimisticMessage[]
  >([]);

  // Reset optimistic messages when real messages change
  useEffect(() => {
    setOptimisticMessages([]);
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, optimisticMessages]);

  const handleMessageSent = useCallback(
    ({ body, purpose }: { body: string; purpose: MessagePurpose }) => {
      setOptimisticMessages((prev) => [
        ...prev,
        {
          id: `optimistic_${Date.now()}`,
          body,
          purpose,
          status: "sending",
          createdAt: new Date(),
        },
      ]);
    },
    []
  );

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
        <MessageSquare className="size-12 mb-3" />
        <p className="text-sm font-medium">Select a conversation</p>
        <p className="text-xs mt-1">
          Choose a conversation from the list to view messages
        </p>
      </div>
    );
  }

  const isOptedOut = !conversation.patient.communicationPreference?.smsOptIn;

  // Group messages by date
  const allMessages = [
    ...messages,
    ...optimisticMessages.map((m) => ({
      ...m,
      direction: "Outbound" as const,
      channel: "SMS" as const,
      mediaUrls: null,
      bodyTextSnapshot: m.body,
    })),
  ];

  const groupedByDate: Record<string, typeof allMessages> = {};
  for (const msg of allMessages) {
    const dateKey = formatDate(msg.createdAt);
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(msg);
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {conversation.patient.firstName} {conversation.patient.lastName}
          </h3>
          <p className="text-xs text-gray-500">
            {conversation.patient.phone || "No phone"}
            {isOptedOut && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                Opted Out
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Opted-out banner */}
      {isOptedOut && (
        <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2">
          <AlertTriangle className="size-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            This patient has opted out of SMS messaging. No messages can be
            sent.
          </p>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {allMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare className="size-8 mb-2" />
            <p className="text-sm">No messages in this conversation</p>
          </div>
        ) : (
          Object.entries(groupedByDate).map(([dateLabel, dateMessages]) => (
            <div key={dateLabel}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-4">
                <span className="rounded-full bg-gray-200 px-3 py-1 text-[10px] font-medium text-gray-500">
                  {dateLabel}
                </span>
              </div>

              {dateMessages.map((msg) => {
                const isOutbound = msg.direction === "Outbound";
                const isSending = "status" in msg && msg.status === "sending";
                const isFailed =
                  "status" in msg && msg.status === "Failed";
                const mediaUrls = msg.mediaUrls
                  ? JSON.parse(msg.mediaUrls)
                  : [];

                return (
                  <div
                    key={msg.id}
                    className={`flex mb-3 ${
                      isOutbound ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        isOutbound
                          ? isFailed
                            ? "bg-red-100 border border-red-300"
                            : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                          : "bg-white border border-gray-200 text-gray-900"
                      } ${isSending ? "opacity-70" : ""}`}
                    >
                      {/* Purpose tag */}
                      {msg.purpose !== "Generic" && (
                        <span
                          className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium mb-1 ${
                            isOutbound && !isFailed
                              ? PURPOSE_COLORS[msg.purpose] || ""
                              : PURPOSE_COLORS_INBOUND[msg.purpose] || ""
                          }`}
                        >
                          {PURPOSE_LABELS[msg.purpose] || msg.purpose}
                        </span>
                      )}

                      {/* Media */}
                      {mediaUrls.length > 0 && (
                        <div className="flex gap-1 mb-1.5">
                          {mediaUrls.map((url: string) => (
                            <img
                              key={url}
                              src={url}
                              alt="Attachment"
                              className="h-32 w-32 rounded-lg object-cover cursor-pointer"
                            />
                          ))}
                        </div>
                      )}

                      {/* Body */}
                      <p
                        className={`text-sm whitespace-pre-wrap break-words ${
                          isFailed ? "text-gray-900" : ""
                        }`}
                      >
                        {msg.bodyTextSnapshot}
                      </p>

                      {/* Footer: time + status */}
                      <div
                        className={`flex items-center gap-1.5 mt-1 ${
                          isOutbound && !isFailed
                            ? "justify-end"
                            : "justify-end"
                        }`}
                      >
                        <span
                          className={`text-[10px] ${
                            isOutbound && !isFailed
                              ? "text-white/60"
                              : "text-gray-400"
                          }`}
                        >
                          {formatTime(msg.createdAt)}
                        </span>
                        {isOutbound &&
                          !isSending &&
                          "status" in msg && (
                            <StatusIcon status={msg.status as string} />
                          )}
                        {isSending && (
                          <Loader2 className="size-3 animate-spin text-white/60" />
                        )}
                      </div>

                      {/* Failed state */}
                      {isFailed && (
                        <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-red-200">
                          <span className="text-[10px] font-medium text-red-600">
                            Failed to send
                          </span>
                          <button
                            onClick={async () => {
                              await retryMessageAction(msg.id);
                            }}
                            className="text-[10px] font-medium text-purple-600 hover:text-purple-700"
                          >
                            Retry
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <MessageComposer
        conversationId={conversation.id}
        canSend={permissions.canSend}
        isOptedOut={isOptedOut}
        patientFirstName={conversation.patient.firstName}
        patientLastName={conversation.patient.lastName}
        templates={templates}
        onMessageSent={handleMessageSent}
      />
    </div>
  );
}
