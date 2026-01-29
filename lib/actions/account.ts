"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import bcrypt from "bcrypt";

export type AccountProfile = {
  name: string;
  alias: string | null;
  pronouns: string | null;
  email: string;
  phone: string | null;
  profileImageUrl: string | null;
};

export async function getAccountProfile(): Promise<AccountProfile> {
  const user = await requireAuth();
  const record = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      name: true,
      alias: true,
      pronouns: true,
      email: true,
      phone: true,
      profileImageUrl: true,
    },
  });
  return record;
}

export async function updateAccountProfile(input: {
  name: string;
  alias: string;
  pronouns: string;
  email: string;
  phone: string;
}): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || !email) {
    return { success: false, error: "Name and email are required." };
  }

  // Check email uniqueness if changed
  if (email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "Email is already in use." };
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      alias: input.alias.trim() || null,
      pronouns: input.pronouns.trim() || null,
      email,
      phone: input.phone.trim() || null,
    },
  });

  return { success: true };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: "New password must be at least 8 characters." };
  }

  const record = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!record.passwordHash) {
    return { success: false, error: "Account does not have a password set." };
  }

  const valid = await bcrypt.compare(currentPassword, record.passwordHash);
  if (!valid) {
    return { success: false, error: "Current password is incorrect." };
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash },
  });

  return { success: true };
}
