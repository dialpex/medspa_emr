"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

// ===========================================
// TYPES
// ===========================================

export type SettingsItem = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  color: string | null;
  capacity: string;
  maxConcurrent: number;
  isActive: boolean;
  type: "Room" | "Resource";
};

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

type ResourceInput = {
  name: string;
  description?: string;
  category?: string;
  color?: string;
  capacity?: string;
  maxConcurrent?: number;
};

// ===========================================
// READ
// ===========================================

export async function getRoomsAndResources(): Promise<SettingsItem[]> {
  const user = await requirePermission("appointments", "view");

  const [rooms, resources] = await Promise.all([
    prisma.room.findMany({
      where: { clinicId: user.clinicId },
      orderBy: { name: "asc" },
    }),
    prisma.resource.findMany({
      where: { clinicId: user.clinicId },
      orderBy: { name: "asc" },
    }),
  ]);

  const items: SettingsItem[] = [
    ...rooms.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      color: r.color,
      capacity: r.capacity,
      maxConcurrent: r.maxConcurrent,
      isActive: r.isActive,
      type: "Room" as const,
    })),
    ...resources.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      color: r.color,
      capacity: r.capacity,
      maxConcurrent: r.maxConcurrent,
      isActive: r.isActive,
      type: "Resource" as const,
    })),
  ];

  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

// ===========================================
// ROOM CRUD
// ===========================================

export async function createRoom(input: ResourceInput): Promise<ActionResult> {
  const user = await requirePermission("appointments", "create");

  await prisma.room.create({
    data: {
      clinicId: user.clinicId,
      name: input.name,
      description: input.description || null,
      category: input.category || null,
      color: input.color || null,
      capacity: input.capacity || "one",
      maxConcurrent: input.maxConcurrent ?? 1,
    },
  });

  revalidatePath("/settings/resources");
  revalidatePath("/calendar");
  return { success: true };
}

export async function updateRoom(
  id: string,
  input: ResourceInput
): Promise<ActionResult> {
  const user = await requirePermission("appointments", "edit");

  const existing = await prisma.room.findFirst({
    where: { id, clinicId: user.clinicId },
  });
  if (!existing) return { success: false, error: "Room not found" };

  await prisma.room.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description || null,
      category: input.category || null,
      color: input.color || null,
      capacity: input.capacity || "one",
      maxConcurrent: input.maxConcurrent ?? 1,
    },
  });

  revalidatePath("/settings/resources");
  revalidatePath("/calendar");
  return { success: true };
}

export async function toggleRoomActive(id: string): Promise<ActionResult> {
  const user = await requirePermission("appointments", "edit");

  const existing = await prisma.room.findFirst({
    where: { id, clinicId: user.clinicId },
  });
  if (!existing) return { success: false, error: "Room not found" };

  await prisma.room.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  revalidatePath("/settings/resources");
  revalidatePath("/calendar");
  return { success: true };
}

// ===========================================
// RESOURCE CRUD
// ===========================================

export async function createResource(input: ResourceInput): Promise<ActionResult> {
  const user = await requirePermission("appointments", "create");

  await prisma.resource.create({
    data: {
      clinicId: user.clinicId,
      name: input.name,
      description: input.description || null,
      category: input.category || null,
      color: input.color || null,
      capacity: input.capacity || "one",
      maxConcurrent: input.maxConcurrent ?? 1,
    },
  });

  revalidatePath("/settings/resources");
  revalidatePath("/calendar");
  return { success: true };
}

export async function updateResource(
  id: string,
  input: ResourceInput
): Promise<ActionResult> {
  const user = await requirePermission("appointments", "edit");

  const existing = await prisma.resource.findFirst({
    where: { id, clinicId: user.clinicId },
  });
  if (!existing) return { success: false, error: "Resource not found" };

  await prisma.resource.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description || null,
      category: input.category || null,
      color: input.color || null,
      capacity: input.capacity || "one",
      maxConcurrent: input.maxConcurrent ?? 1,
    },
  });

  revalidatePath("/settings/resources");
  revalidatePath("/calendar");
  return { success: true };
}

export async function toggleResourceActive(id: string): Promise<ActionResult> {
  const user = await requirePermission("appointments", "edit");

  const existing = await prisma.resource.findFirst({
    where: { id, clinicId: user.clinicId },
  });
  if (!existing) return { success: false, error: "Resource not found" };

  await prisma.resource.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  revalidatePath("/settings/resources");
  revalidatePath("/calendar");
  return { success: true };
}
