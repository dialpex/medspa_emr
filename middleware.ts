import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Rate limiting for API routes
  // Only rate-limit sign-in (brute force protection), not session checks
  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(req);
    const isSignIn = pathname === "/api/auth/callback/credentials";
    const limit = isSignIn ? 10 : 100;
    const window = 60_000; // 1 minute
    const key = `${isSignIn ? "signin" : "api"}:${ip}`;

    const result = rateLimit(key, limit, window);
    if (!result.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": "60" },
        }
      );
    }
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // MFA pending check — restrict to MFA page only
  const token = req.auth as unknown as Record<string, unknown>;
  if (token.mfaPending && !token.mfaVerified && !pathname.startsWith("/login/mfa")) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "MFA verification required" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/login/mfa", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
