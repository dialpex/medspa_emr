"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Hook that warns users before navigating away from a page with unsaved changes.
 * Handles both browser navigation (refresh/close) and Next.js client-side navigation.
 */
export function useUnsavedChanges(isDirty: boolean) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const pendingHrefRef = useRef<string | null>(null);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Block browser refresh / tab close
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Intercept clicks on <a> tags (breadcrumbs, links) before Next.js processes them
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      // Only intercept same-origin navigations
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
      } catch {
        return;
      }

      if (isDirtyRef.current) {
        e.preventDefault();
        e.stopPropagation();
        pendingHrefRef.current = href;
        setShowConfirm(true);
      }
    };

    // Use capture phase to intercept before Next.js Link handler
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [isDirty]);

  // Intercept browser back/forward
  useEffect(() => {
    if (!isDirty) return;

    const handler = () => {
      if (isDirtyRef.current) {
        // Push current URL back to undo the popstate
        window.history.pushState(null, "", window.location.href);
        pendingHrefRef.current = null;
        setShowConfirm(true);
      }
    };

    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [isDirty]);

  const confirmNavigation = useCallback(() => {
    const href = pendingHrefRef.current;
    pendingHrefRef.current = null;
    isDirtyRef.current = false;
    setShowConfirm(false);
    if (href) {
      router.push(href);
    } else {
      // Back/forward button case — go back
      window.history.back();
    }
  }, [router]);

  const cancelNavigation = useCallback(() => {
    pendingHrefRef.current = null;
    setShowConfirm(false);
  }, []);

  return { showConfirm, confirmNavigation, cancelNavigation };
}
