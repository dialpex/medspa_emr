"use client";

export function ShimmerText({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block animate-shimmer bg-gradient-to-r from-gray-400 via-gray-600 via-gray-400 to-gray-400 bg-[length:200%_100%] bg-clip-text text-transparent">
      {children}
    </span>
  );
}
