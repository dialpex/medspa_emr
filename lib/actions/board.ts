"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import {
  getActiveEntries,
  createEntry,
  toggleComplete,
  deleteEntry,
  type BoardEntryData,
  type BoardEntryView,
} from "@/lib/services/board";

export type { BoardEntryView } from "@/lib/services/board";

export async function getBoardEntries(): Promise<BoardEntryView[]> {
  const user = await requirePermission("board", "view");
  return getActiveEntries(prisma, user.clinicId);
}

export async function createBoardEntry(
  data: BoardEntryData
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requirePermission("board", "create");
    await createEntry(prisma, user.clinicId, user.id, data);
    revalidatePath("/today");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function toggleBoardEntry(
  entryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requirePermission("board", "edit");
    await toggleComplete(prisma, entryId, user.id, user.clinicId);
    revalidatePath("/today");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function deleteBoardEntry(
  entryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requirePermission("board", "delete");
    await deleteEntry(prisma, entryId, user.clinicId);
    revalidatePath("/today");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function getClinicUsers(): Promise<
  { id: string; name: string }[]
> {
  const user = await requirePermission("board", "view");
  const users = await prisma.user.findMany({
    where: { clinicId: user.clinicId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return users;
}

export async function getCurrentUserId(): Promise<string> {
  const user = await requirePermission("board", "view");
  return user.id;
}
