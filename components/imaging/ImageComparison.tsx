"use client"

import { useState, useRef } from "react"
import {
  SlidersHorizontal,
  Columns2,
  Lock,
  Unlock,
  Grid3x3,
  RotateCcw,
} from "lucide-react"
import type { ComparisonMode, ImageComparisonProps } from "./types"
import { CompareSlider } from "./CompareSlider"
import { ZoomSyncPair } from "./ZoomSyncPair"
import { cn } from "@/lib/utils"

export function ImageComparison({
  before,
  after,
  defaultMode = "slider",
  showToolbar = true,
  className,
}: ImageComparisonProps) {
  const [mode, setMode] = useState<ComparisonMode>(defaultMode)
  const [syncLocked, setSyncLocked] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const resetRef = useRef<(() => void) | null>(null)

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {showToolbar && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2.5">
          {/* Mode toggle */}
          <div className="flex items-center rounded-lg bg-gray-100 p-0.5">
            <button
              onClick={() => setMode("slider")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                mode === "slider"
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
              aria-label="Slider comparison mode"
            >
              <SlidersHorizontal className="size-4" />
              Slider
            </button>
            <button
              onClick={() => setMode("side-by-side")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                mode === "side-by-side"
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
              aria-label="Side-by-side comparison mode"
            >
              <Columns2 className="size-4" />
              Side by Side
            </button>
          </div>

          {/* Side-by-side controls */}
          {mode === "side-by-side" && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSyncLocked((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                  syncLocked
                    ? "bg-purple-50 text-purple-700"
                    : "text-gray-500 hover:text-gray-700",
                )}
                aria-label={syncLocked ? "Unlock zoom sync" : "Lock zoom sync"}
              >
                {syncLocked ? (
                  <Lock className="size-4" />
                ) : (
                  <Unlock className="size-4" />
                )}
                Sync
              </button>
              <button
                onClick={() => setShowGrid((v) => !v)}
                className={cn(
                  "rounded-lg p-1.5 transition-all",
                  showGrid
                    ? "bg-purple-50 text-purple-700"
                    : "text-gray-500 hover:text-gray-700",
                )}
                aria-label={showGrid ? "Hide grid overlay" : "Show grid overlay"}
              >
                <Grid3x3 className="size-4" />
              </button>
              <button
                onClick={() => resetRef.current?.()}
                className="rounded-lg p-1.5 text-gray-500 transition-all hover:text-gray-700"
                aria-label="Reset view"
              >
                <RotateCcw className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Comparison area */}
      <div className="min-h-[400px]">
        {mode === "slider" ? (
          <CompareSlider before={before} after={after} />
        ) : (
          <ZoomSyncPair
            before={before}
            after={after}
            syncLocked={syncLocked}
            showGrid={showGrid}
            resetRef={resetRef}
            className="h-[500px]"
          />
        )}
      </div>
    </div>
  )
}
