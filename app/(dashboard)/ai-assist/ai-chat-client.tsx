"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, RotateCcw } from "lucide-react";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";
import { Persona, type PersonaState } from "@/components/ai/persona";

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isPending?: boolean;
  startedAt?: number;
}

const EXAMPLE_PROMPTS = [
  "Look up Botox service",
  "Show me today's appointments",
  "Find patient Smith",
  "What's our revenue this month?",
];

export default function AiChatClient() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
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

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setSessionId(null);
  }, []);

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
        startedAt: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, pendingMsg]);
      setIsLoading(true);

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, sessionId }),
        });

        if (!res.ok) {
          throw new Error("Failed to get AI response");
        }

        const data = await res.json();

        // Store session ID for subsequent messages
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsg.id
              ? { ...m, isPending: false, content: data.response }
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
                  content: "Something went wrong. Please try again.",
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sessionId]
  );

  const personaState: PersonaState = isLoading ? "thinking" : "idle";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Neuvvia Insights</h1>
              <p className="text-xs text-gray-500">
                Intelligence that works while you care
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={startNewConversation}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <RotateCcw className="size-3.5" />
              New conversation
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4">
                <Persona state={personaState} variant="glint" className="size-24" />
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
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
