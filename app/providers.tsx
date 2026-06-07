"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect, type ReactNode } from "react";

/**
 * Patch Performance.measure to suppress Turbopack's "negative time stamp" bug
 * in Next.js 16.x dev mode. Safe to remove once Next.js fixes it upstream.
 */
function usePatchPerformanceMeasure() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const original = performance.measure.bind(performance);
    performance.measure = function (...args: Parameters<typeof performance.measure>) {
      try {
        return original(...args);
      } catch {
        // Swallow "cannot have a negative time stamp" errors from Turbopack router
        return undefined as unknown as PerformanceMeasure;
      }
    };
    return () => {
      performance.measure = original;
    };
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  usePatchPerformanceMeasure();
  return <SessionProvider>{children}</SessionProvider>;
}
