"use server";

import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  getConnectStatus,
  createConnectAccount,
  createAccountLink,
  syncAccountStatus,
  type ConnectStatus,
} from "@/lib/services/stripe-connect";

export type DepositSettings = {
  depositEnabled: boolean;
  defaultDepositAmount: number | null;
  depositPolicy: string | null;
};

export async function connectStripeAction(): Promise<
  | { success: true; data: { url: string } }
  | { success: false; error: string }
> {
  try {
    const user = await requirePermission("invoices", "edit");

    if (!["Owner", "Admin"].includes(user.role)) {
      return { success: false, error: "Only Owner or Admin can connect payments" };
    }

    const clinic = await import("@/lib/prisma").then((m) =>
      m.prisma.clinic.findUniqueOrThrow({
        where: { id: user.clinicId },
        select: { email: true, stripeAccountId: true },
      })
    );

    const stripeAccountId = clinic.stripeAccountId || await createConnectAccount(user.clinicId, clinic.email || user.email);
    const url = await createAccountLink(stripeAccountId, user.clinicId);

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "StripeAccountConnect",
      entityType: "Clinic",
      entityId: user.clinicId,
      details: JSON.stringify({ stripeAccountId }),
    });

    return { success: true, data: { url } };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    return { success: false, error: error instanceof Error ? error.message : "Failed to connect payments" };
  }
}

export async function refreshOnboardingAction(): Promise<
  | { success: true; data: { url: string } }
  | { success: false; error: string }
> {
  try {
    const user = await requirePermission("invoices", "edit");

    if (!["Owner", "Admin"].includes(user.role)) {
      return { success: false, error: "Only Owner or Admin can manage payments" };
    }

    const status = await getConnectStatus(user.clinicId);

    if (!status.stripeAccountId) {
      return { success: false, error: "No payment account found. Connect payments first." };
    }

    const url = await createAccountLink(status.stripeAccountId, user.clinicId);
    return { success: true, data: { url } };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    return { success: false, error: error instanceof Error ? error.message : "Failed to refresh onboarding" };
  }
}

export async function getStripeStatusAction(): Promise<
  | { success: true; data: ConnectStatus }
  | { success: false; error: string }
> {
  try {
    const user = await requirePermission("invoices", "view");
    const status = await syncAccountStatus(user.clinicId);
    return { success: true, data: status };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    return { success: false, error: error instanceof Error ? error.message : "Failed to get payment status" };
  }
}

export async function getDepositSettingsAction(): Promise<
  | { success: true; data: DepositSettings }
  | { success: false; error: string }
> {
  try {
    const user = await requirePermission("invoices", "view");
    const { prisma } = await import("@/lib/prisma");
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: user.clinicId },
      select: { depositEnabled: true, defaultDepositAmount: true, depositPolicy: true },
    });
    return { success: true, data: clinic };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    return { success: false, error: error instanceof Error ? error.message : "Failed to get deposit settings" };
  }
}

export async function updateDepositSettingsAction(settings: {
  depositEnabled: boolean;
  defaultDepositAmount: number | null;
  depositPolicy: string | null;
}): Promise<
  | { success: true }
  | { success: false; error: string }
> {
  try {
    const user = await requirePermission("invoices", "edit");

    if (!["Owner", "Admin"].includes(user.role)) {
      return { success: false, error: "Only Owner or Admin can manage deposit settings" };
    }

    const { prisma } = await import("@/lib/prisma");
    await prisma.clinic.update({
      where: { id: user.clinicId },
      data: {
        depositEnabled: settings.depositEnabled,
        defaultDepositAmount: settings.defaultDepositAmount,
        depositPolicy: settings.depositPolicy,
      },
    });

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "SettingsUpdate",
      entityType: "Clinic",
      entityId: user.clinicId,
      details: JSON.stringify({ type: "deposit_settings", ...settings }),
    });

    revalidatePath("/settings/billing");
    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    return { success: false, error: error instanceof Error ? error.message : "Failed to update deposit settings" };
  }
}
