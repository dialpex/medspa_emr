"use client";

import { useState, useRef, useTransition } from "react";
import { Send, Paperclip, X, Loader2 } from "lucide-react";
import { sendMessageAction } from "@/lib/actions/messaging";
import { TemplatePicker } from "./template-picker";
import { EmojiPicker } from "./emoji-picker";
import type { MessagePurpose, MessageTemplate } from "@prisma/client";

interface Attachment {
  url: string;
  filename: string;
  preview: string;
}

export function MessageComposer({
  conversationId,
  canSend,
  isOptedOut,
  patientFirstName,
  patientLastName,
  templates,
  onMessageSent,
}: {
  conversationId: string;
  canSend: boolean;
  isOptedOut: boolean;
  patientFirstName: string;
  patientLastName: string;
  templates: MessageTemplate[];
  onMessageSent: (optimisticMessage: {
    body: string;
    purpose: MessagePurpose;
  }) => void;
}) {
  const [body, setBody] = useState("");
  const [purpose, setPurpose] = useState<MessagePurpose>("Generic");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      setBody(body.slice(0, start) + text + body.slice(end));
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
      });
    } else {
      setBody((prev) => prev + text);
    }
  };

  const disabled = !canSend || isOptedOut || !body.trim() || isUploading || isPending;

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conversationId", conversationId);

      const res = await fetch("/api/messaging/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      setAttachments((prev) => [
        ...prev,
        {
          url: data.url,
          filename: file.name,
          preview: URL.createObjectURL(file),
        },
      ]);
    } catch {
      setError("Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  const handleSend = () => {
    if (disabled) return;

    const messageBody = body.trim();
    const messagePurpose = purpose;
    const mediaUrls = attachments.map((a) => a.url);

    // Optimistic update
    onMessageSent({ body: messageBody, purpose: messagePurpose });

    // Reset form
    setBody("");
    setPurpose("Generic");
    setAttachments([]);
    setError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    startTransition(async () => {
      const result = await sendMessageAction({
        conversationId,
        body: messageBody,
        purpose: messagePurpose,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      });

      if (!result.success) {
        setError(result.error || "Failed to send message");
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTemplateSelect = (templateBody: string, templatePurpose: MessagePurpose) => {
    setBody(templateBody);
    setPurpose(templatePurpose);
    textareaRef.current?.focus();
  };

  if (isOptedOut) {
    return (
      <div className="border-t border-gray-200 bg-amber-50 px-4 py-3">
        <p className="text-sm text-amber-700 text-center">
          This patient has opted out of SMS messaging. Messages cannot be sent.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex gap-2 px-4 pt-3">
          {attachments.map((att, i) => (
            <div key={i} className="relative group">
              <img
                src={att.preview}
                alt={att.filename}
                className="h-16 w-16 rounded-lg object-cover border border-gray-200"
              />
              <button
                onClick={() => removeAttachment(i)}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 pt-2">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-2 p-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
            title="Attach image"
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Paperclip className="size-4" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          <EmojiPicker onSelect={insertAtCursor} />

          <TemplatePicker
            templates={templates}
            patientFirstName={patientFirstName}
            patientLastName={patientLastName}
            onSelect={handleTemplateSelect}
          />
        </div>

        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-300"
        />

        <button
          onClick={handleSend}
          disabled={disabled}
          className="flex items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 p-2.5 text-white transition-all hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Send message"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
