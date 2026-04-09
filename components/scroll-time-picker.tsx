"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ClockIcon } from "lucide-react";

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PAD = Math.floor(VISIBLE_ITEMS / 2);
const BAND_TOP = PAD * ITEM_HEIGHT;

type ScrollColumnProps = {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
};

function ScrollColumn({ items, selectedIndex, onChange }: ScrollColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressSnap = useRef(false);
  const snapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scrollToIndex = useCallback((index: number, smooth = false) => {
    const el = containerRef.current;
    if (!el) return;
    suppressSnap.current = true;
    el.scrollTo({ top: index * ITEM_HEIGHT, behavior: smooth ? "smooth" : "instant" });
    clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => { suppressSnap.current = false; }, smooth ? 250 : 60);
  }, []);

  useEffect(() => {
    scrollToIndex(selectedIndex);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!suppressSnap.current) scrollToIndex(selectedIndex, true);
  }, [selectedIndex, scrollToIndex]);

  const onScrollEnd = useCallback(() => {
    if (suppressSnap.current) return;
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (clamped !== selectedIndex) onChange(clamped);
    const target = clamped * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) > 1) {
      suppressSnap.current = true;
      el.scrollTo({ top: target, behavior: "smooth" });
      snapTimer.current = setTimeout(() => { suppressSnap.current = false; }, 250);
    }
  }, [items.length, selectedIndex, onChange]);

  const scrollDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleScroll = useCallback(() => {
    clearTimeout(scrollDebounce.current);
    scrollDebounce.current = setTimeout(onScrollEnd, 80);
  }, [onScrollEnd]);

  return (
    <div
      ref={containerRef}
      className="scroll-col"
      style={{
        height: PICKER_HEIGHT,
        overflowY: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
      onScroll={handleScroll}
    >
      {Array.from({ length: PAD }).map((_, i) => (
        <div key={`pt${i}`} style={{ height: ITEM_HEIGHT }} />
      ))}
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        return (
          <div
            key={`${item}-${index}`}
            onClick={() => { onChange(index); scrollToIndex(index, true); }}
            className="flex items-center justify-center cursor-pointer select-none"
            style={{
              height: ITEM_HEIGHT,
              fontSize: isSelected ? 18 : 15,
              fontWeight: isSelected ? 700 : 600,
              color: isSelected ? "#ffffff" : "#6b7280",
            }}
          >
            {item}
          </div>
        );
      })}
      {Array.from({ length: PAD }).map((_, i) => (
        <div key={`pb${i}`} style={{ height: ITEM_HEIGHT }} />
      ))}
    </div>
  );
}

// --- Data ---
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const PERIODS = ["AM", "PM"];

type ScrollTimePickerProps = {
  value: string; // "HH:MM" 24h
  onChange: (time: string) => void;
  disabled?: boolean;
};

export function ScrollTimePicker({ value, onChange, disabled }: ScrollTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [hourStr, minuteStr] = (value || "09:00").split(":");
  const hour24 = parseInt(hourStr, 10);
  const isPM = hour24 >= 12;
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const minuteVal = parseInt(minuteStr, 10);
  const minute5 = Math.round(minuteVal / 5) * 5 % 60;

  const hourIdx = HOURS.indexOf(String(hour12).padStart(2, "0"));
  const minIdx = MINUTES.indexOf(String(minute5).padStart(2, "0"));
  const periodIdx = isPM ? 1 : 0;

  const buildTime = (h12: number, min: number, pm: boolean): string => {
    let h24: number;
    if (pm) h24 = h12 === 12 ? 12 : h12 + 12;
    else h24 = h12 === 12 ? 0 : h12;
    return `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  };

  const display = `${hour12}:${String(minute5).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  return (
    <div ref={wrapperRef} className="relative">
      <style>{`.scroll-col::-webkit-scrollbar { display: none; }`}</style>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
      >
        <span className="font-medium">{display}</span>
        <ClockIcon className="h-4 w-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl p-2">
          <div className="relative" style={{ height: PICKER_HEIGHT }}>
            {/* Single highlight band spanning all columns */}
            <div
              className="absolute left-0 right-0 rounded-lg pointer-events-none"
              style={{
                top: BAND_TOP,
                height: ITEM_HEIGHT,
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                zIndex: 0,
              }}
            />

            <div className="relative flex" style={{ height: PICKER_HEIGHT, zIndex: 1 }}>
              {/* Hours */}
              <div style={{ width: 56 }}>
                <ScrollColumn
                  items={HOURS}
                  selectedIndex={hourIdx >= 0 ? hourIdx : 0}
                  onChange={(i) => {
                    const h = parseInt(HOURS[i], 10);
                    onChange(buildTime(h, minute5, isPM));
                  }}
                />
              </div>
              {/* Minutes */}
              <div style={{ width: 56 }}>
                <ScrollColumn
                  items={MINUTES}
                  selectedIndex={minIdx >= 0 ? minIdx : 0}
                  onChange={(i) => {
                    const m = parseInt(MINUTES[i], 10);
                    onChange(buildTime(hour12, m, isPM));
                  }}
                />
              </div>
              {/* AM/PM — scrollable just like hours and minutes */}
              <div style={{ width: 56 }}>
                <ScrollColumn
                  items={PERIODS}
                  selectedIndex={periodIdx}
                  onChange={(i) => {
                    const pm = i === 1;
                    onChange(buildTime(hour12, minute5, pm));
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
