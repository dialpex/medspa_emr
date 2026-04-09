import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/migration/crypto";
import { verifyTOTP, verifyBackupCode } from "@/lib/mfa/totp";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const token: string = body.token;

    if (!token || token.length < 6) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { totpSecret: true, totpEnabled: true, backupCodes: true },
    });

    if (!user.totpEnabled || !user.totpSecret) {
      return NextResponse.json({ error: "MFA not enabled" }, { status: 400 });
    }

    const secret = decrypt(user.totpSecret);
    let verified = false;

    // Try TOTP first
    if (token.length === 6 && verifyTOTP(secret, token)) {
      verified = true;
    }

    // Try backup code
    if (!verified && user.backupCodes) {
      const hashes: string[] = JSON.parse(decrypt(user.backupCodes));
      const result = verifyBackupCode(token, hashes);
      if (result.valid) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { backupCodes: encrypt(JSON.stringify(result.remainingHashes)) },
        });
        verified = true;
      }
    }

    if (!verified) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 401 });
    }

    // Stamp totpVerifiedAt — the JWT callback checks this on session update
    await prisma.user.update({
      where: { id: session.user.id },
      data: { totpVerifiedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MFA Verify] Error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
