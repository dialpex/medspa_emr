"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { ChatInput, type ChatAttachment } from "./chat-input";
import { MessageBubble } from "./message-bubble";
import { Persona, type PersonaState } from "@/components/ai/persona";
import type { AIResponse, PlanStep, ChatMessage } from "@/lib/agents/chat/types";

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: AIResponse;
  isPending?: boolean;
  isExecuting?: boolean;
  startedAt?: number;
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

  /** Build conversation history from current messages for API calls. */
  const buildHistory = useCallback((): ChatMessage[] => {
    return messages
      .filter((m) => !m.isPending)
      .map((m) => ({
        role: m.role,
        content:
          m.role === "assistant" && m.response
            ? JSON.stringify(m.response)
            : m.content,
      }));
  }, [messages]);

  const executePlan = useCallback(
    async (steps: PlanStep[], direct = false) => {
      if (isLoading) return;

      const userMsg: UIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: "Confirm",
      };
      const pendingMsg: UIMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        isPending: true,
        isExecuting: true,
        startedAt: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, pendingMsg]);
      setIsLoading(true);

      try {
        const body: Record<string, unknown> = { steps };
        if (!direct) {
          body.messages = buildHistory();
        }

        const res = await fetch("/api/ai/chat/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          throw new Error("Failed to execute plan");
        }

        const data = await res.json();
        const response: AIResponse = data.response;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsg.id
              ? { ...m, isPending: false, isExecuting: false, response, content: response.rationale_muted }
              : m
          )
        );
      } catch {
        // Fallback: send "Confirm" as regular message to AI
        setMessages((prev) => prev.filter((m) => m.id !== pendingMsg.id && m.id !== userMsg.id));
        setIsLoading(false);
        sendMessage("Confirm");
        return;
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoading, buildHistory]
  );

  const sendMessage = useCallback(
    async (text: string, attachment?: ChatAttachment) => {
      if (isLoading) return;

      // Compose message content: if attachment present, prepend invoice context
      let messageContent = text;
      if (attachment) {
        const userText = text || "Process this invoice and update inventory.";
        messageContent = `[Uploaded invoice: ${attachment.fileName}]\n\n${attachment.extractedText}\n\n${userText}`;
      }

      const userMsg: UIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: attachment ? `${text || "Process this invoice"} [${attachment.fileName}]` : text,
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
        // Build conversation history for the API
        const history: ChatMessage[] = [
          ...buildHistory(),
          { role: "user" as const, content: messageContent },
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
    [isLoading, buildHistory]
  );

  const cancelPlan = useCallback(() => {
    const userMsg: UIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: "Cancel",
    };
    const assistantMsg: UIMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Plan cancelled.",
      response: {
        type: "result",
        domain: "general",
        rationale_muted: "Plan cancelled.",
        clarification: null,
        plan: null,
        result: { summary: "Plan cancelled. Let me know if you need anything else.", details: {} },
        permission_check: { allowed: true, reason_if_denied: null },
      },
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
  }, []);

  const personaState: PersonaState = isLoading ? "thinking" : "idle";

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
            messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onSend={sendMessage}
                onExecutePlan={executePlan}
                onCancelPlan={cancelPlan}
                isLast={i === messages.length - 1}
              />
            ))
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={(msg, att) => sendMessage(msg, att)} disabled={isLoading} />
    </div>
  );
}
