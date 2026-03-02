"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ShimmerText } from "./shimmer";

interface ReasoningProps {
  isStreaming: boolean;
  rationale?: string;
}

export function Reasoning({ isStreaming, rationale }: ReasoningProps) {
  const [open, setOpen] = useState(true);
  const [duration, setDuration] = useState(0);
  const startTime = useRef<number>(Date.now());
  const hasCollapsed = useRef(false);

  // Track elapsed time while streaming
  useEffect(() => {
    if (!isStreaming) return;
    startTime.current = Date.now();
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  // Auto-collapse 1s after response arrives
  useEffect(() => {
    if (!isStreaming && !hasCollapsed.current && rationale) {
      hasCollapsed.current = true;
      setDuration(Math.floor((Date.now() - startTime.current) / 1000));
      const timer = setTimeout(() => setOpen(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, rationale]);

  // Don't render if there's no rationale and not streaming
  if (!isStreaming && !rationale) return null;

  const durationLabel =
    duration > 0 ? `${duration}s` : "<1s";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600"
        >
          <ChevronRight
            className={`size-3 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          />
          {isStreaming ? (
            <ShimmerText>Thinking...</ShimmerText>
          ) : (
            <span>Thought for {durationLabel}</span>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1.5 border-l-2 border-gray-200 pl-3 text-xs leading-relaxed text-gray-500">
          {isStreaming ? (
            <ShimmerText>Analyzing your request...</ShimmerText>
          ) : (
            rationale
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
