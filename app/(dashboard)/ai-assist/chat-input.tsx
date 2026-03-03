"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Paperclip, X, Loader2 } from "lucide-react";

export interface ChatAttachment {
  fileName: string;
  extractedText: string;
}

export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (message: string, attachment?: ChatAttachment) => void;
  disabled: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  const handleSend = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const text = el.value.trim();
    if ((!text && !attachment) || disabled || isUploading) return;
    onSend(text, attachment ?? undefined);
    el.value = "";
    el.style.height = "auto";
    setAttachment(null);
  }, [onSend, disabled, isUploading, attachment]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset file input so the same file can be re-selected
      e.target.value = "";

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/ai/chat/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Upload failed");
        }

        const data = await res.json();
        setAttachment({
          fileName: data.fileName,
          extractedText: data.text,
        });
      } catch (err) {
        console.error("File upload failed:", err);
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      <div className="mx-auto max-w-3xl">
        {/* Attachment chip */}
        {attachment && (
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700">
              <Paperclip className="size-3" />
              {attachment.fileName}
              <button
                onClick={() => setAttachment(null)}
                className="ml-1 rounded-full p-0.5 hover:bg-purple-100"
              >
                <X className="size-3" />
              </button>
            </span>
          </div>
        )}

        {/* Uploading indicator */}
        {isUploading && (
          <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="size-3 animate-spin" />
            Extracting text from file...
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Paperclip button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-300 bg-gray-50 text-gray-500 transition-colors hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600 disabled:opacity-40"
          >
            <Paperclip className="size-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />

          <textarea
            ref={textareaRef}
            placeholder="Ask anything about your clinic..."
            className="flex-1 resize-none rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
            rows={1}
            disabled={disabled || isUploading}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={handleSend}
            disabled={disabled || isUploading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
