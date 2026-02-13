"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { NotificationTrigger, TimingUnit } from "@prisma/client";

export type NotificationTemplateItem = {
  id: string;
  key: string | null;
  name: string;
  description: string | null;
  trigger: NotificationTrigger;
  offsetValue: number;
  offsetUnit: TimingUnit;
  bodyText: string;
  bodyHtml: string | null;
  emailEnabled: boolean;
  textEnabled: boolean;
  isActive: boolean;
  isSystem: boolean;
  systemKey: string | null;
};

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

type NotificationInput = {
  name: string;
  description?: string;
  trigger: NotificationTrigger;
  offsetValue: number;
  offsetUnit: TimingUnit;
  bodyText: string;
  bodyHtml?: string;
};

export type ClinicPreviewData = {
  clinicName: string;
  reviewLink: string;
};

export async function getClinicPreviewData(): Promise<ClinicPreviewData> {
  const user = await requirePermission("messaging", "view");

  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: user.clinicId },
    select: { name: true, socialAccounts: true },
  });

  const social = clinic.socialAccounts
    ? JSON.parse(clinic.socialAccounts)
    : {};

  return {
    clinicName: clinic.name,
    reviewLink: social.googleReviewLink || "",
  };
}

export async function getNotificationTemplates(): Promise<
  NotificationTemplateItem[]
> {
  const user = await requirePermission("messaging", "view");

  const templates = await prisma.notificationTemplate.findMany({
    where: { clinicId: user.clinicId },
    orderBy: [{ trigger: "asc" }, { offsetValue: "asc" }],
  });

  return templates.map((t) => ({
    id: t.id,
    key: t.key,
    name: t.name,
    description: t.description,
    trigger: t.trigger,
    offsetValue: t.offsetValue,
    offsetUnit: t.offsetUnit,
    bodyText: t.bodyText,
    bodyHtml: t.bodyHtml,
    emailEnabled: t.emailEnabled,
    textEnabled: t.textEnabled,
    isActive: t.isActive,
    isSystem: t.isSystem,
    systemKey: t.systemKey,
  }));
}

export async function createNotificationTemplate(
  input: NotificationInput
): Promise<ActionResult> {
  const user = await requirePermission("messaging", "create");

  const trimmedName = input.name.trim();
  if (!trimmedName) return { success: false, error: "Name is required" };
  if (!input.bodyText.trim())
    return { success: false, error: "Message body is required" };
  if (input.offsetValue < 0)
    return { success: false, error: "Timing value must be at least 0" };

  await prisma.notificationTemplate.create({
    data: {
      clinicId: user.clinicId,
      name: trimmedName,
      description: input.description?.trim() || null,
      trigger: input.trigger,
      offsetValue: input.offsetValue,
      offsetUnit: input.offsetUnit,
      bodyText: input.bodyText.trim(),
      bodyHtml: input.bodyHtml || null,
    },
  });

  revalidatePath("/settings/notifications");
  return { success: true };
}

export async function updateNotificationTemplate(
  id: string,
  input: NotificationInput
): Promise<ActionResult> {
  const user = await requirePermission("messaging", "create");

  const existing = await prisma.notificationTemplate.findFirst({
    where: { id, clinicId: user.clinicId },
  });
  if (!existing) return { success: false, error: "Template not found" };

  const trimmedName = input.name.trim();
  if (!trimmedName) return { success: false, error: "Name is required" };
  if (!input.bodyText.trim())
    return { success: false, error: "Message body is required" };
  if (input.offsetValue < 0)
    return { success: false, error: "Timing value must be at least 0" };

  if (existing.isSystem && existing.key) {
    const existingOverride = await prisma.notificationTemplate.findFirst({
      where: { clinicId: user.clinicId, systemKey: existing.key },
    });

    if (existingOverride) {
      await prisma.notificationTemplate.update({
        where: { id: existingOverride.id },
        data: {
          name: trimmedName,
          description: input.description?.trim() || null,
          trigger: input.trigger,
          offsetValue: input.offsetValue,
          offsetUnit: input.offsetUnit,
          bodyText: input.bodyText.trim(),
          bodyHtml: input.bodyHtml || null,
        },
      });
    } else {
      await prisma.notificationTemplate.create({
        data: {
          clinicId: user.clinicId,
          systemKey: existing.key,
          name: trimmedName,
          description: input.description?.trim() || null,
          trigger: input.trigger,
          offsetValue: input.offsetValue,
          offsetUnit: input.offsetUnit,
          bodyText: input.bodyText.trim(),
          bodyHtml: input.bodyHtml || null,
          emailEnabled: existing.emailEnabled,
          textEnabled: existing.textEnabled,
          isActive: existing.isActive,
        },
      });
    }
  } else {
    await prisma.notificationTemplate.update({
      where: { id },
      data: {
        name: trimmedName,
        description: input.description?.trim() || null,
        trigger: input.trigger,
        offsetValue: input.offsetValue,
        offsetUnit: input.offsetUnit,
        bodyText: input.bodyText.trim(),
        bodyHtml: input.bodyHtml || null,
      },
    });
  }

  revalidatePath("/settings/notifications");
  return { success: true };
}

export async function deleteNotificationTemplate(
  id: string
): Promise<ActionResult> {
  const user = await requirePermission("messaging", "create");

  const existing = await prisma.notificationTemplate.findFirst({
    where: { id, clinicId: user.clinicId },
  });
  if (!existing) return { success: false, error: "Template not found" };
  if (existing.isSystem)
    return { success: false, error: "Cannot delete system templates" };

  await prisma.notificationTemplate.delete({ where: { id } });

  revalidatePath("/settings/notifications");
  return { success: true };
}

export async function resetNotificationTemplate(
  systemKey: string
): Promise<ActionResult> {
  const user = await requirePermission("messaging", "create");

  const override = await prisma.notificationTemplate.findFirst({
    where: { clinicId: user.clinicId, systemKey, isSystem: false },
  });
  if (!override) return { success: false, error: "No custom override found" };

  await prisma.notificationTemplate.delete({ where: { id: override.id } });

  revalidatePath("/settings/notifications");
  return { success: true };
}

export async function toggleNotificationChannel(
  id: string,
  channel: "email" | "text"
): Promise<ActionResult> {
  const user = await requirePermission("messaging", "create");

  const existing = await prisma.notificationTemplate.findFirst({
    where: { id, clinicId: user.clinicId },
  });
  if (!existing) return { success: false, error: "Template not found" };

  const data =
    channel === "email"
      ? { emailEnabled: !existing.emailEnabled }
      : { textEnabled: !existing.textEnabled };

  await prisma.notificationTemplate.update({
    where: { id },
    data,
  });

  revalidatePath("/settings/notifications");
  return { success: true };
}
