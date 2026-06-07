"use client"

import { useState, useRef, useCallback } from "react"
import type { ComparisonImage } from "./types"
import { cn } from "@/lib/utils"

function resolveImageUrl(src: string): string {
  if (src.startsWith("/") || src.startsWith("http")) return src
  return `/api/photos/${src}`
}

interface CompareSliderProps {
  before: ComparisonImage
  after: ComparisonImage
  /** Vertical offset for the "after" image in % (positive = shift down) */
  afterOffsetY?: number
  className?: string
}

export function CompareSlider({
  before,
  after,
  afterOffsetY = 0,
  className,
}: CompareSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)

  const updatePosition = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = clientX - rect.left
      setPosition(Math.max(0, Math.min(100, (x / rect.width) * 100)))
    },
    [],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(true)
      updatePosition(e.clientX)
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [updatePosition],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      updatePosition(e.clientX)
    },
    [isDragging, updatePosition],
  )

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const imgClass = "absolute inset-0 h-full w-full select-none pointer-events-none object-cover"

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-xl bg-gray-100 cursor-col-resize select-none",
        className,
      )}
      style={{ aspectRatio: "4/3" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* After image — full frame behind */}
      <img
        src={resolveImageUrl(after.src)}
        alt={after.label}
        draggable={false}
        className={imgClass}
        style={{ objectPosition: `center ${50 + afterOffsetY}%` }}
      />

      {/* Before image — clipped with clip-path so it stays aligned */}
      <img
        src={resolveImageUrl(before.src)}
        alt={before.label}
        draggable={false}
        className={imgClass}
        style={{
          objectPosition: "center 50%",
          clipPath: `inset(0 ${100 - position}% 0 0)`,
        }}
      />

      {/* Slider line + handle */}
      <div
        className="absolute top-0 bottom-0 z-10 pointer-events-none"
        style={{ left: `${position}%`, transform: "translateX(-50%)" }}
      >
        <div className="h-full w-0.5 bg-white/80 shadow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-white shadow-lg">
          <div className="flex gap-0.5">
            <div className="h-4 w-0.5 rounded-full bg-gray-400" />
            <div className="h-4 w-0.5 rounded-full bg-gray-400" />
            <div className="h-4 w-0.5 rounded-full bg-gray-400" />
          </div>
        </div>
      </div>

      {/* Labels */}
      <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
        {before.label}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
        {after.label}
      </span>
    </div>
  )
}
