import { Spinner } from "@/components/ui/spinner";

// Route-level loading state
export default function Loading() {
  return (
    <div className="p-6 max-w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
      <CalendarSkeleton />
    </div>
  );
}

// Skeleton for Suspense fallback
export function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filters skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-20 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse ml-4" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-36 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Calendar grid skeleton */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50">
          <div className="p-3 border-r border-gray-200">
            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
          </div>
          {[...Array(7)].map((_, i) => (
            <div key={`hdr-${i}`} className="p-3 border-r border-gray-200 last:border-r-0">
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mx-auto" />
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div className="relative h-[800px]">
          {/* Loading spinner overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <div className="flex flex-col items-center gap-3">
              <Spinner className="h-8 w-8 text-gray-400" />
              <span className="text-sm text-gray-500">Loading calendar...</span>
            </div>
          </div>

          {/* Time grid skeleton */}
          <div className="grid grid-cols-8">
            {/* Time column */}
            <div className="border-r border-gray-200">
              {[...Array(13)].map((_, i) => (
                <div
                  key={`time-${i}`}
                  className="h-16 border-b border-gray-100 flex items-start justify-end pr-2 pt-1"
                >
                  <div className="h-3 w-10 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>

            {/* Day columns */}
            {[...Array(7)].map((_, dayIdx) => (
              <div key={`day-${dayIdx}`} className="border-r border-gray-200 last:border-r-0">
                {[...Array(13)].map((_, hourIdx) => (
                  <div
                    key={`hour-${hourIdx}`}
                    className="h-16 border-b border-gray-100"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend skeleton */}
      <div className="flex flex-wrap gap-4">
        {[...Array(7)].map((_, i) => (
          <div key={`legend-${i}`} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
