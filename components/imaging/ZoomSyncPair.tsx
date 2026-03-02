"use client"

import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch"
import { memo, useRef, useCallback, type MutableRefObject } from "react"
import type { ComparisonImage } from "./types"
import { cn } from "@/lib/utils"

function resolveImageUrl(src: string): string {
  if (src.startsWith("/") || src.startsWith("http")) return src
  return `/api/photos/${src}`
}

interface ZoomPanelProps {
  image: ComparisonImage
  panelRef: MutableRefObject<ReactZoomPanPinchRef | null>
  onTransformed: (state: { scale: number; positionX: number; positionY: number }) => void
  onInteractionEnd: () => void
  showGrid: boolean
}

const ZoomPanel = memo(function ZoomPanel({
  image,
  panelRef,
  onTransformed,
  onInteractionEnd,
  showGrid,
}: ZoomPanelProps) {
  return (
    <div
      className="relative flex-1 min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
      style={{ touchAction: "none" }}
      onMouseUp={onInteractionEnd}
      onMouseLeave={onInteractionEnd}
      onTouchEnd={onInteractionEnd}
    >
      <TransformWrapper
        ref={panelRef}
        centerOnInit
        minScale={0.5}
        maxScale={8}
        onTransformed={(_ref, state) => {
          onTransformed({
            scale: state.scale,
            positionX: state.positionX,
            positionY: state.positionY,
          })
        }}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ width: "100%", height: "100%" }}
        >
          <img
            src={resolveImageUrl(image.src)}
            alt={image.label}
            decoding="async"
            loading="lazy"
            draggable={false}
            className="h-full w-full object-contain"
          />
        </TransformComponent>
      </TransformWrapper>

      <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
        {image.label}
      </span>

      {showGrid && (
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent calc(33.33% - 0.5px), #6b7280 calc(33.33% - 0.5px), #6b7280 calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px)), " +
              "repeating-linear-gradient(90deg, transparent, transparent calc(33.33% - 0.5px), #6b7280 calc(33.33% - 0.5px), #6b7280 calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px))",
          }}
        />
      )}
    </div>
  )
})

interface ZoomSyncPairProps {
  before: ComparisonImage
  after: ComparisonImage
  syncLocked: boolean
  showGrid: boolean
  resetRef: MutableRefObject<(() => void) | null>
  className?: string
}

export function ZoomSyncPair({
  before,
  after,
  syncLocked,
  showGrid,
  resetRef,
  className,
}: ZoomSyncPairProps) {
  const leftRef = useRef<ReactZoomPanPinchRef | null>(null)
  const rightRef = useRef<ReactZoomPanPinchRef | null>(null)
  const isSyncing = useRef(false)
  const activeSource = useRef<"left" | "right" | null>(null)

  const handleTransformed = useCallback(
    (source: "left" | "right", state: { scale: number; positionX: number; positionY: number }) => {
      if (isSyncing.current) return
      if (!syncLocked) return
      if (activeSource.current !== null && activeSource.current !== source) return

      activeSource.current = source
      isSyncing.current = true

      const targetRef = source === "left" ? rightRef : leftRef
      targetRef.current?.setTransform(state.positionX, state.positionY, state.scale, 0)

      requestAnimationFrame(() => {
        isSyncing.current = false
      })
    },
    [syncLocked],
  )

  const handleLeftTransformed = useCallback(
    (state: { scale: number; positionX: number; positionY: number }) => {
      handleTransformed("left", state)
    },
    [handleTransformed],
  )

  const handleRightTransformed = useCallback(
    (state: { scale: number; positionX: number; positionY: number }) => {
      handleTransformed("right", state)
    },
    [handleTransformed],
  )

  const clearActiveSource = useCallback(() => {
    activeSource.current = null
  }, [])

  const resetView = useCallback(() => {
    if (isSyncing.current) return
    isSyncing.current = true
    leftRef.current?.resetTransform(200)
    rightRef.current?.resetTransform(200)
    setTimeout(() => {
      isSyncing.current = false
    }, 250)
  }, [])

  resetRef.current = resetView

  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row",
        className,
      )}
      style={{ height: "100%" }}
    >
      <ZoomPanel
        image={before}
        panelRef={leftRef}
        onTransformed={handleLeftTransformed}
        onInteractionEnd={clearActiveSource}
        showGrid={showGrid}
      />
      <ZoomPanel
        image={after}
        panelRef={rightRef}
        onTransformed={handleRightTransformed}
        onInteractionEnd={clearActiveSource}
        showGrid={showGrid}
      />
    </div>
  )
}
