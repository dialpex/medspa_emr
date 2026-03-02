"use client"

import ReactCompareImage from "react-compare-image"
import type { ComparisonImage } from "./types"
import { cn } from "@/lib/utils"

function resolveImageUrl(src: string): string {
  if (src.startsWith("/") || src.startsWith("http")) return src
  return `/api/photos/${src}`
}

function SliderHandle() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-white shadow-lg">
      <div className="flex gap-0.5">
        <div className="h-4 w-0.5 rounded-full bg-gray-400" />
        <div className="h-4 w-0.5 rounded-full bg-gray-400" />
        <div className="h-4 w-0.5 rounded-full bg-gray-400" />
      </div>
    </div>
  )
}

interface CompareSliderProps {
  before: ComparisonImage
  after: ComparisonImage
  className?: string
}

export function CompareSlider({ before, after, className }: CompareSliderProps) {
  return (
    <div className={cn("relative rounded-xl overflow-hidden bg-gray-100", className)}>
      <ReactCompareImage
        leftImage={resolveImageUrl(before.src)}
        rightImage={resolveImageUrl(after.src)}
        leftImageLabel=""
        rightImageLabel=""
        sliderLineColor="#d1d5db"
        sliderLineWidth={2}
        handle={<SliderHandle />}
      />
      <span className="absolute left-3 top-3 rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
        {before.label}
      </span>
      <span className="absolute right-3 top-3 rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
        {after.label}
      </span>
    </div>
  )
}
