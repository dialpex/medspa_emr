"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";
import type { AIResponse, ChatMessage } from "@/lib/ai/providers/types";

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: AIResponse;
  isPending?: boolean;
}

const EXAMPLE_PROMPTS = [
  "Schedule an appointment for tomorrow",
  "Show me revenue for this month",
  "Look up a patient",
  "What appointments do I have today?",
];

export default function AiChatClient() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (isLoading) return;

      const userMsg: UIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };
      const pendingMsg: UIMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        isPending: true,
      };

      setMessages((prev) => [...prev, userMsg, pendingMsg]);
      setIsLoading(true);

      try {
        // Build conversation history for the API
        const history: ChatMessage[] = [
          ...messages
            .filter((m) => !m.isPending)
            .map((m) => ({
              role: m.role,
              content:
                m.role === "assistant" && m.response
                  ? JSON.stringify(m.response)
                  : m.content,
            })),
          { role: "user" as const, content: text },
        ];

        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });

        if (!res.ok) {
          throw new Error("Failed to get AI response");
        }

        const response: AIResponse = await res.json();

        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsg.id
              ? { ...m, isPending: false, response, content: response.rationale_muted }
              : m
          )
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsg.id
              ? {
                  ...m,
                  isPending: false,
                  response: {
                    type: "refuse" as const,
                    domain: "general",
                    rationale_muted: "Something went wrong. Please try again.",
                    clarification: null,
                    plan: null,
                    result: null,
                    permission_check: {
                      allowed: false,
                      reason_if_denied: "Something went wrong. Please try again.",
                    },
                  },
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">AI Assist</h1>
            <p className="text-xs text-gray-500">
              Your EMR operating system
            </p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100">
                <Sparkles className="size-8 text-purple-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                How can I help you today?
              </h2>
              <p className="mt-2 max-w-md text-sm text-gray-500">
                I can help with scheduling, patient lookup, revenue insights, inventory management, and more.
              </p>
              <div className="mt-8 grid w-full max-w-lg grid-cols-2 gap-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-600 transition-colors hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onSend={sendMessage}
              />
            ))
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
