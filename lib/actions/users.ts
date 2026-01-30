"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import bcrypt from "bcrypt";

export type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  alias: string | null;
  pronouns: string | null;
  isActive: boolean;
};

export async function getUsersForClinic(): Promise<UserItem[]> {
  const user = await requirePermission("users", "view");
  const users = await prisma.user.findMany({
    where: { clinicId: user.clinicId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      alias: true,
      pronouns: true,
      isActive: true,
    },
  });
  return users.map((u) => ({ ...u, role: u.role as string }));
}

export async function getUser(id: string): Promise<UserItem | null> {
  const user = await requirePermission("users", "view");
  const u = await prisma.user.findFirst({
    where: { id, clinicId: user.clinicId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      alias: true,
      pronouns: true,
      isActive: true,
    },
  });
  if (!u) return null;
  return { ...u, role: u.role as string };
}

type UserInput = {
  name: string;
  email: string;
  role: string;
  phone?: string;
  alias?: string;
  pronouns?: string;
  password?: string;
};

export async function createUser(input: UserInput) {
  const user = await requirePermission("users", "create");
  if (!input.name || !input.email || !input.role || !input.password) {
    throw new Error("Name, email, role, and password are required");
  }

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existing) throw new Error("A user with this email already exists");

  const passwordHash = await bcrypt.hash(input.password, 10);

  await prisma.user.create({
    data: {
      clinicId: user.clinicId,
      name: input.name,
      email: input.email,
      role: input.role as any,
      phone: input.phone || null,
      alias: input.alias || null,
      pronouns: input.pronouns || null,
      passwordHash,
    },
  });

  revalidatePath("/settings/users");
}

export async function updateUser(id: string, input: UserInput) {
  const user = await requirePermission("users", "edit");
  const existing = await prisma.user.findFirst({
    where: { id, clinicId: user.clinicId },
  });
  if (!existing) throw new Error("User not found");

  // Check email uniqueness if changed
  if (input.email !== existing.email) {
    const dup = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (dup) throw new Error("A user with this email already exists");
  }

  const data: Record<string, unknown> = {
    name: input.name,
    email: input.email,
    role: input.role as any,
    phone: input.phone || null,
    alias: input.alias || null,
    pronouns: input.pronouns || null,
  };

  if (input.password) {
    data.passwordHash = await bcrypt.hash(input.password, 10);
  }

  await prisma.user.update({ where: { id }, data });
  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${id}`);
}

export async function toggleUserActive(id: string) {
  const user = await requirePermission("users", "edit");
  const existing = await prisma.user.findFirst({
    where: { id, clinicId: user.clinicId },
  });
  if (!existing) throw new Error("User not found");
  await prisma.user.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });
  revalidatePath("/settings/users");
}
