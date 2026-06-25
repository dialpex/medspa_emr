import type { PrismaClient } from "@prisma/client";

export type BoardEntryData = {
  content: string;
  type?: string;
  priority?: string;
  category?: string | null;
  assignedToId?: string | null;
  mentions?: string | null;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
};

export type BoardEntryView = {
  id: string;
  content: string;
  type: string;
  priority: string;
  category: string | null;
  isCompleted: boolean;
  completedAt: Date | null;
  assignedToId: string | null;
  assignedToName: string | null;
  mentions: string | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
  createdById: string;
  createdByName: string;
  createdAt: Date;
};

function getNextOccurrence(rule: string | null): Date {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  switch (rule) {
    case "daily":
      return tomorrow;
    case "weekdays": {
      const next = new Date(tomorrow);
      // Skip to Monday if tomorrow is Saturday (6) or Sunday (0)
      const day = next.getDay();
      if (day === 0) next.setDate(next.getDate() + 1);
      else if (day === 6) next.setDate(next.getDate() + 2);
      return next;
    }
    case "weekly": {
      const next = new Date(now);
      next.setDate(next.getDate() + 7);
      next.setHours(0, 0, 0, 0);
      return next;
    }
    case "monthly": {
      const next = new Date(now);
      next.setMonth(next.getMonth() + 1);
      next.setHours(0, 0, 0, 0);
      return next;
    }
    default:
      return tomorrow;
  }
}

export async function getActiveEntries(
  prisma: PrismaClient,
  clinicId: string
): Promise<BoardEntryView[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const now = new Date();
  const entries = await prisma.boardEntry.findMany({
    where: {
      clinicId,
      deletedAt: null,
      createdAt: { lte: now },
      OR: [
        { isCompleted: false },
        { isCompleted: true, completedAt: { gte: startOfToday } },
      ],
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: [{ isCompleted: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
  });

  return entries.map((e) => ({
    id: e.id,
    content: e.content,
    type: e.type,
    priority: e.priority,
    category: e.category,
    isCompleted: e.isCompleted,
    completedAt: e.completedAt,
    assignedToId: e.assignedToId,
    assignedToName: e.assignedTo?.name ?? null,
    mentions: e.mentions,
    isRecurring: e.isRecurring,
    recurrenceRule: e.recurrenceRule,
    createdById: e.createdById,
    createdByName: e.createdBy.name,
    createdAt: e.createdAt,
  }));
}

export async function createEntry(
  prisma: PrismaClient,
  clinicId: string,
  userId: string,
  data: BoardEntryData
) {
  if (!data.content || data.content.length > 500) {
    throw new Error("Content is required and must be 500 characters or fewer");
  }

  return prisma.boardEntry.create({
    data: {
      clinicId,
      createdById: userId,
      content: data.content,
      type: data.type ?? "task",
      priority: data.priority ?? "normal",
      category: data.category ?? "general",
      assignedToId: data.assignedToId ?? null,
      mentions: data.mentions ?? null,
      isRecurring: data.isRecurring ?? false,
      recurrenceRule: data.recurrenceRule ?? null,
    },
  });
}

export async function toggleComplete(
  prisma: PrismaClient,
  entryId: string,
  userId: string,
  clinicId: string
) {
  const entry = await prisma.boardEntry.findFirst({
    where: { id: entryId, clinicId, deletedAt: null },
  });

  if (!entry) throw new Error("Board entry not found");

  const nowCompleting = !entry.isCompleted;

  await prisma.boardEntry.update({
    where: { id: entryId },
    data: {
      isCompleted: nowCompleting,
      completedAt: nowCompleting ? new Date() : null,
      completedById: nowCompleting ? userId : null,
    },
  });

  // If completing a recurring entry, clone it with a future createdAt
  if (nowCompleting && entry.isRecurring) {
    const nextDate = getNextOccurrence(entry.recurrenceRule);
    await prisma.boardEntry.create({
      data: {
        clinicId: entry.clinicId,
        createdById: entry.createdById,
        content: entry.content,
        type: entry.type,
        priority: entry.priority,
        category: entry.category,
        assignedToId: entry.assignedToId,
        mentions: entry.mentions,
        isRecurring: true,
        recurrenceRule: entry.recurrenceRule,
        createdAt: nextDate,
      },
    });
  }
}

export async function deleteEntry(
  prisma: PrismaClient,
  entryId: string,
  clinicId: string
) {
  const entry = await prisma.boardEntry.findFirst({
    where: { id: entryId, clinicId, deletedAt: null },
  });

  if (!entry) throw new Error("Board entry not found");

  await prisma.boardEntry.update({
    where: { id: entryId },
    data: { deletedAt: new Date() },
  });
}
