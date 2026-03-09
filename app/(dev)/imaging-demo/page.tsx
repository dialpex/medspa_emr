"use client"

import { ImageComparison } from "@/components/imaging"

export default function ImagingDemoPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Clinical Imaging Comparison
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Compare before and after treatment images with slider or synced
          side-by-side zoom.
        </p>
      </div>

      <ImageComparison
        before={{
          src: "https://placehold.co/800x600/e2e8f0/64748b?text=Before",
          label: "Before",
        }}
        after={{
          src: "https://placehold.co/800x600/ddd6fe/7c3aed?text=After",
          label: "After",
        }}
      />

      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
        <h2 className="mb-2 font-semibold text-gray-900">Testing hints</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <strong>Slider mode:</strong> Drag the handle left/right to reveal
            before/after
          </li>
          <li>
            <strong>Side-by-side:</strong> Scroll to zoom, drag to pan &mdash;
            the other panel mirrors in real time when sync is locked
          </li>
          <li>
            <strong>Unlock sync:</strong> Click the lock icon to zoom/pan each
            panel independently
          </li>
          <li>
            <strong>Grid overlay:</strong> Toggle the grid icon to show a 3x3
            alignment guide
          </li>
          <li>
            <strong>Reset:</strong> Click the reset icon to return both panels
            to the initial centered view
          </li>
        </ul>
      </div>
    </div>
  )
}
