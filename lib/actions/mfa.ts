"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { generateTOTPSecret, verifyTOTP, generateBackupCodes } from "@/lib/mfa/totp";
import { encrypt, decrypt } from "@/lib/migration/crypto";

export async function setupMFA(): Promise<{
  success: boolean;
  secret?: string;
  uri?: string;
  error?: string;
}> {
  const user = await requireAuth();

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { totpEnabled: true, email: true },
  });

  if (dbUser.totpEnabled) {
    return { success: false, error: "MFA is already enabled" };
  }

  const { secret, uri } = generateTOTPSecret(dbUser.email);

  // Store encrypted secret (not yet enabled — needs verification)
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: encrypt(secret) },
  });

  return { success: true, secret, uri };
}

export async function verifyAndActivateMFA(token: string): Promise<{
  success: boolean;
  backupCodes?: string[];
  error?: string;
}> {
  const user = await requireAuth();

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (dbUser.totpEnabled) {
    return { success: false, error: "MFA is already active" };
  }

  if (!dbUser.totpSecret) {
    return { success: false, error: "MFA setup not initiated. Call setupMFA first." };
  }

  const secret = decrypt(dbUser.totpSecret);
  if (!verifyTOTP(secret, token)) {
    return { success: false, error: "Invalid verification code" };
  }

  const { codes, hashes } = generateBackupCodes();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpEnabled: true,
      totpVerifiedAt: new Date(),
      backupCodes: encrypt(JSON.stringify(hashes)),
    },
  });

  await createAuditLog({
    clinicId: user.clinicId,
    userId: user.id,
    action: "SettingsUpdate",
    entityType: "User",
    entityId: user.id,
    details: JSON.stringify({ action: "mfa_enabled" }),
  });

  return { success: true, backupCodes: codes };
}

export async function disableMFA(token: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await requireAuth();

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!dbUser.totpEnabled || !dbUser.totpSecret) {
    return { success: false, error: "MFA is not enabled" };
  }

  const secret = decrypt(dbUser.totpSecret);
  if (!verifyTOTP(secret, token)) {
    return { success: false, error: "Invalid verification code" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpEnabled: false,
      totpSecret: null,
      totpVerifiedAt: null,
      backupCodes: null,
    },
  });

  await createAuditLog({
    clinicId: user.clinicId,
    userId: user.id,
    action: "SettingsUpdate",
    entityType: "User",
    entityId: user.id,
    details: JSON.stringify({ action: "mfa_disabled" }),
  });

  return { success: true };
}

export async function getMFAStatus(): Promise<{ enabled: boolean }> {
  const user = await requireAuth();
  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { totpEnabled: true },
  });
  return { enabled: dbUser.totpEnabled };
}
