import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncAccountStatus } from "@/lib/services/stripe-connect";

export async function GET() {
  const session = await auth();
  const clinicId = (session?.user as Record<string, unknown>)?.clinicId as string | undefined;

  if (clinicId) {
    try {
      await syncAccountStatus(clinicId);
    } catch {
      // Best-effort sync; Settings page will retry
    }
  }

  return NextResponse.redirect(new URL("/settings/billing", process.env.APP_URL || "http://localhost:3000"));
}
