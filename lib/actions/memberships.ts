"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export type MembershipPlanItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billingCycle: string;
  isActive: boolean;
};

export type MembershipDataItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billingCycle: string;
  isActive: boolean;
  activeMembers: number;
  pausedMembers: number;
  cancelledMembers: number;
  totalMembers: number;
  mrr: number;
  churnRate: number;
  createdAt: Date;
};

export type PatientMembershipItem = {
  id: string;
  status: string;
  startDate: Date;
  nextBillDate: Date | null;
  cancelledAt: Date | null;
  patient: { id: string; firstName: string; lastName: string };
  plan: { name: string; price: number };
};

export type MembershipPlanInput = {
  name: string;
  description?: string;
  price: number;
  billingCycle?: string;
};

export async function getMembershipPlans(): Promise<MembershipPlanItem[]> {
  const user = await requirePermission("invoices", "view");
  return prisma.membershipPlan.findMany({
    where: { clinicId: user.clinicId },
    orderBy: { name: "asc" },
  });
}

export async function getMembershipData(): Promise<MembershipDataItem[]> {
  const user = await requirePermission("invoices", "view");

  const plans = await prisma.membershipPlan.findMany({
    where: { clinicId: user.clinicId },
    include: {
      patientMemberships: {
        select: { status: true },
      },
    },
    orderBy: { price: "asc" },
  });

  return plans.map((plan) => {
    const active = plan.patientMemberships.filter((m) => m.status === "Active").length;
    const paused = plan.patientMemberships.filter((m) => m.status === "Paused").length;
    const cancelled = plan.patientMemberships.filter((m) => m.status === "Cancelled").length;
    const total = plan.patientMemberships.length;
    const multiplier = plan.billingCycle === "Weekly" ? 4.33 : 1;
    const mrr = active * plan.price * multiplier;
    const churnRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      billingCycle: plan.billingCycle,
      isActive: plan.isActive,
      activeMembers: active,
      pausedMembers: paused,
      cancelledMembers: cancelled,
      totalMembers: total,
      mrr: Math.round(mrr * 100) / 100,
      churnRate,
      createdAt: plan.createdAt,
    };
  });
}

export async function createMembershipPlan(input: MembershipPlanInput) {
  try {
    const user = await requirePermission("invoices", "create");
    await prisma.membershipPlan.create({
      data: {
        clinicId: user.clinicId,
        name: input.name,
        description: input.description || null,
        price: input.price,
        billingCycle: input.billingCycle || "Monthly",
      },
    });
    revalidatePath("/sales");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function updateMembershipPlan(id: string, input: MembershipPlanInput) {
  try {
    await requirePermission("invoices", "edit");
    await prisma.membershipPlan.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description || null,
        price: input.price,
        billingCycle: input.billingCycle || "Monthly",
      },
    });
    revalidatePath("/sales");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function toggleMembershipPlanActive(id: string) {
  try {
    const user = await requirePermission("invoices", "edit");
    const plan = await prisma.membershipPlan.findFirst({ where: { id, clinicId: user.clinicId } });
    if (!plan) return { success: false as const, error: "Plan not found" };
    await prisma.membershipPlan.update({ where: { id }, data: { isActive: !plan.isActive } });
    revalidatePath("/sales");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function getPatientMemberships(): Promise<PatientMembershipItem[]> {
  const user = await requirePermission("invoices", "view");
  return prisma.patientMembership.findMany({
    where: { clinicId: user.clinicId },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      plan: { select: { name: true, price: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function assignMembershipToPatient(input: { patientId: string; planId: string }) {
  try {
    const user = await requirePermission("invoices", "create");
    const plan = await prisma.membershipPlan.findFirst({ where: { id: input.planId, clinicId: user.clinicId, isActive: true } });
    if (!plan) return { success: false as const, error: "Plan not found or inactive" };

    const now = new Date();
    const nextBill = new Date(now);
    if (plan.billingCycle === "Weekly") {
      nextBill.setDate(nextBill.getDate() + 7);
    } else {
      nextBill.setMonth(nextBill.getMonth() + 1);
    }

    await prisma.patientMembership.create({
      data: {
        clinicId: user.clinicId,
        patientId: input.patientId,
        planId: input.planId,
        status: "Active",
        startDate: now,
        nextBillDate: nextBill,
      },
    });

    revalidatePath("/sales");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function cancelMembership(id: string) {
  try {
    await requirePermission("invoices", "edit");
    await prisma.patientMembership.update({
      where: { id },
      data: { status: "Cancelled", cancelledAt: new Date(), nextBillDate: null },
    });
    revalidatePath("/sales");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function pauseMembership(id: string) {
  try {
    await requirePermission("invoices", "edit");
    await prisma.patientMembership.update({
      where: { id },
      data: { status: "Paused", nextBillDate: null },
    });
    revalidatePath("/sales");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function resumeMembership(id: string) {
  try {
    await requirePermission("invoices", "edit");
    const nextBill = new Date();
    nextBill.setMonth(nextBill.getMonth() + 1);
    await prisma.patientMembership.update({
      where: { id },
      data: { status: "Active", nextBillDate: nextBill },
    });
    revalidatePath("/sales");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    throw error;
  }
}
