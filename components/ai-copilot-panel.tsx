"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { XIcon, SendIcon, Loader2Icon, SparklesIcon, CheckIcon } from "lucide-react";
import type { TemplateFieldConfig } from "@/lib/types/charts";

interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
  suggestedFields?: TemplateFieldConfig[];
  suggestedName?: string;
  suggestedType?: string;
  suggestedCategory?: string;
  isComplete?: boolean;
}

interface AiCopilotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  onApplyResult: (data: {
    fields: TemplateFieldConfig[];
    name?: string;
    type?: string;
    category?: string;
  }) => void;
  apiEndpoint?: string;
}

export function AiCopilotPanel({
  isOpen,
  onClose,
  title = "AI Template Assistant",
  onApplyResult,
  apiEndpoint = "/api/ai/templates",
}: AiCopilotPanelProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            "Hi! I can help you create a template. What kind of template do you need? For example:\n\n- A Botox treatment chart\n- A patient intake form\n- A consent form for dermal fillers\n\nDescribe your workflow and I'll build it for you.",
        },
      ]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: CopilotMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "AI request failed");
      }

      const result = await response.json();
      const assistantMsg: CopilotMessage = {
        role: "assistant",
        content: result.message,
        suggestedFields: result.suggestedFields,
        suggestedName: result.suggestedName,
        suggestedType: result.suggestedType,
        suggestedCategory: result.suggestedCategory,
        isComplete: result.isComplete,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, something went wrong: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, apiEndpoint]);

  const handleApply = (msg: CopilotMessage) => {
    if (msg.suggestedFields) {
      onApplyResult({
        fields: msg.suggestedFields,
        name: msg.suggestedName ?? undefined,
        type: msg.suggestedType ?? undefined,
        category: msg.suggestedCategory ?? undefined,
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div
        className="w-[400px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
              <SparklesIcon className="size-4" />
            </div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {msg.suggestedFields && msg.suggestedFields.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-200/50">
                    <p className="text-xs font-medium text-gray-500 mb-1.5">
                      Generated {msg.suggestedFields.length} fields
                      {msg.suggestedName && ` for "${msg.suggestedName}"`}
                    </p>
                    <button
                      onClick={() => handleApply(msg)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 w-full justify-center"
                    >
                      <CheckIcon className="size-3.5" />
                      Apply to Template
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-xl px-3.5 py-2.5">
                <Loader2Icon className="size-4 animate-spin text-gray-400" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-5 py-3 border-t border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Describe your template..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="p-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SendIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
