"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export type PaymentListItem = {
  id: string;
  amount: number;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  createdAt: Date;
  invoice: {
    invoiceNumber: string;
    patient: { id: string; firstName: string; lastName: string };
  };
};

export type PaymentFilters = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  method?: string;
};

export async function getPayments(filters?: PaymentFilters): Promise<PaymentListItem[]> {
  const user = await requirePermission("invoices", "view");

  const where: Record<string, unknown> = { clinicId: user.clinicId, deletedAt: null, invoice: { deletedAt: null } };

  if (filters?.method) where.paymentMethod = filters.method;
  if (filters?.dateFrom || filters?.dateTo) {
    where.createdAt = {};
    if (filters?.dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(filters.dateFrom);
    if (filters?.dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(filters.dateTo + "T23:59:59Z");
  }
  if (filters?.search) {
    where.invoice = {
      patient: {
        OR: [
          { firstName: { contains: filters.search } },
          { lastName: { contains: filters.search } },
        ],
      },
    };
  }

  return prisma.payment.findMany({
    where,
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
