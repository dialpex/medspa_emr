"use client";

import { Loader2 } from "lucide-react";
import { Reasoning } from "@/components/ai/reasoning";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isPending?: boolean;
  startedAt?: number;
}

export function MessageBubble({ message }: { message: Message }) {
  // User message
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }

  // Pending state
  if (message.isPending) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <Reasoning isStreaming={true} />
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" />
            Thinking...
          </div>
        </div>
      </div>
    );
  }

  // Assistant response — render as markdown-like text
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl border border-gray-200 bg-white px-4 py-3">
        <div className="prose prose-sm prose-gray max-w-none text-sm text-gray-800 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5">
          <AssistantContent content={message.content} />
        </div>
      </div>
    </div>
  );
}

/** Simple markdown-like rendering for assistant responses. */
function AssistantContent({ content }: { content: string }) {
  if (!content) return <p className="text-gray-500 italic">No response</p>;

  // Split into paragraphs and render with basic formatting
  const paragraphs = content.split("\n\n");

  return (
    <>
      {paragraphs.map((para, i) => {
        // Check if this is a list block
        const lines = para.split("\n");
        const isList = lines.every(
          (l) => l.trim().startsWith("- ") || l.trim().startsWith("* ") || /^\d+\.\s/.test(l.trim()) || l.trim() === ""
        );

        if (isList) {
          const isOrdered = lines.some((l) => /^\d+\.\s/.test(l.trim()));
          const Tag = isOrdered ? "ol" : "ul";
          return (
            <Tag key={i}>
              {lines
                .filter((l) => l.trim())
                .map((line, j) => (
                  <li key={j}>
                    <InlineFormatted
                      text={line.replace(/^[\s]*[-*]\s|^\d+\.\s/, "")}
                    />
                  </li>
                ))}
            </Tag>
          );
        }

        return (
          <p key={i}>
            <InlineFormatted text={para.replace(/\n/g, " ")} />
          </p>
        );
      })}
    </>
  );
}

/** Render inline bold/italic formatting. */
function InlineFormatted({ text }: { text: string }) {
  // Split on **bold** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
