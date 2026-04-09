"use client";

import { useSession } from "next-auth/react";
import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

export function SessionTimeoutMonitor() {
  const { data: session, update, status } = useSession({ required: true });
  const router = useRouter();
  const lastActivityRef = useRef(Date.now());

  const handleActivity = useCallback(() => {
    const now = Date.now();
    // Only call update if more than 60 seconds since last activity refresh
    if (now - lastActivityRef.current > 60_000) {
      lastActivityRef.current = now;
      update();
    }
  }, [update]);

  useEffect(() => {
    // Debounced activity listeners
    let timeout: ReturnType<typeof setTimeout>;
    const debouncedHandler = () => {
      clearTimeout(timeout);
      timeout = setTimeout(handleActivity, 1000);
    };

    window.addEventListener("mousemove", debouncedHandler);
    window.addEventListener("keydown", debouncedHandler);
    window.addEventListener("click", debouncedHandler);
    window.addEventListener("scroll", debouncedHandler);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("mousemove", debouncedHandler);
      window.removeEventListener("keydown", debouncedHandler);
      window.removeEventListener("click", debouncedHandler);
      window.removeEventListener("scroll", debouncedHandler);
    };
  }, [handleActivity]);

  // Poll session status every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      update();
    }, 60_000);
    return () => clearInterval(interval);
  }, [update]);

  // Redirect on session loss
  useEffect(() => {
    if (!session && status !== "loading") {
      router.push("/login?reason=timeout");
    }
  }, [session, status, router]);

  return null;
}
