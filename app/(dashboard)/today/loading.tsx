export default function Loading() {
  return (
    <div className="p-6 max-w-full mx-auto">
      <TodaySkeleton />
    </div>
  );
}

export function TodaySkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div>
        <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mt-2" />
      </div>

      {/* Filters skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 w-36 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-10 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-10 w-20 bg-gray-200 rounded-lg animate-pulse ml-auto" />
      </div>

      {/* Phase tabs skeleton */}
      <div className="flex items-center gap-1 border-b border-gray-200 pb-0">
        {[...Array(5)].map((_, i) => (
          <div key={`tab-${i}`} className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>

      {/* List skeleton */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white divide-y divide-gray-100">
        {[...Array(6)].map((_, i) => (
          <div key={`row-${i}`} className="flex items-center gap-4 px-4 py-3">
            <div className="w-[140px] flex-shrink-0">
              <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-56 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="flex-shrink-0">
              <div className="h-7 w-24 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
