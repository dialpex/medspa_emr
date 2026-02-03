"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  createdAt: Date;
  dueDate: Date | null;
  paidAt: Date | null;
  patient: { id: string; firstName: string; lastName: string };
  _count: { payments: number };
};

export type InvoiceDetail = {
  id: string;
  clinicId: string;
  patientId: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  discountPercent: number | null;
  taxAmount: number;
  taxRate: number | null;
  total: number;
  notes: string | null;
  dueDate: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  patient: { id: string; firstName: string; lastName: string };
  items: {
    id: string;
    serviceId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  payments: {
    id: string;
    amount: number;
    paymentMethod: string;
    reference: string | null;
    notes: string | null;
    createdAt: Date;
  }[];
};

export type InvoiceFilters = {
  status?: string;
  search?: string;
  invoiceNumber?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type InvoiceItemInput = {
  serviceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type InvoiceInput = {
  patientId: string;
  items: InvoiceItemInput[];
  discountAmount?: number;
  discountPercent?: number | null;
  taxRate?: number | null;
  notes?: string;
  dueDate?: string;
  status?: string;
};

export type PaymentInput = {
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
};

async function generateInvoiceNumber(clinicId: string): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `INV-${dateStr}-`;

  const lastInvoice = await prisma.invoice.findFirst({
    where: { clinicId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let seq = 1;
  if (lastInvoice) {
    const lastSeq = parseInt(lastInvoice.invoiceNumber.split("-").pop() || "0", 10);
    seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, "0")}`;
}

function calculateTotals(items: InvoiceItemInput[], discountAmount: number, discountPercent: number | null, taxRate: number | null) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  let discount = discountAmount;
  if (discountPercent != null && discountPercent > 0) {
    discount = subtotal * (discountPercent / 100);
  }
  const afterDiscount = subtotal - discount;
  const tax = taxRate != null && taxRate > 0 ? afterDiscount * (taxRate / 100) : 0;
  const total = afterDiscount + tax;
  return { subtotal: Math.round(subtotal * 100) / 100, discountAmount: Math.round(discount * 100) / 100, taxAmount: Math.round(tax * 100) / 100, total: Math.round(total * 100) / 100 };
}

export async function getInvoices(filters?: InvoiceFilters): Promise<InvoiceListItem[]> {
  const user = await requirePermission("invoices", "view");

  const where: Record<string, unknown> = { clinicId: user.clinicId, deletedAt: null };
  if (filters?.status) where.status = filters.status;
  if (filters?.invoiceNumber) where.invoiceNumber = { contains: filters.invoiceNumber };
  if (filters?.search) {
    const q = filters.search.trim();
    const parts = q.split(/\s+/);
    if (parts.length >= 2) {
      where.patient = {
        AND: [
          { firstName: { contains: parts[0] } },
          { lastName: { contains: parts.slice(1).join(" ") } },
        ],
      };
    } else {
      where.patient = {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
        ],
      };
    }
  }
  if (filters?.dateFrom || filters?.dateTo) {
    where.createdAt = {};
    if (filters?.dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(filters.dateFrom);
    if (filters?.dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(filters.dateTo + "T23:59:59Z");
  }

  return prisma.invoice.findMany({
    where,
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { payments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  const user = await requirePermission("invoices", "view");

  const invoice = await prisma.invoice.findFirst({
    where: { id, clinicId: user.clinicId, deletedAt: null },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      items: { where: { deletedAt: null }, select: { id: true, serviceId: true, description: true, quantity: true, unitPrice: true, total: true } },
      payments: { where: { deletedAt: null }, select: { id: true, amount: true, paymentMethod: true, reference: true, notes: true, createdAt: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (invoice) {
    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "InvoiceView",
        entityType: "Invoice",
        entityId: invoice.id,
        details: JSON.stringify({ invoiceNumber: invoice.invoiceNumber }),
      },
    });
  }

  return invoice;
}

export async function createInvoice(input: InvoiceInput) {
  try {
    const user = await requirePermission("invoices", "create");
    const invoiceNumber = await generateInvoiceNumber(user.clinicId);
    const totals = calculateTotals(input.items, input.discountAmount ?? 0, input.discountPercent ?? null, input.taxRate ?? null);

    const invoice = await prisma.invoice.create({
      data: {
        clinicId: user.clinicId,
        patientId: input.patientId,
        invoiceNumber,
        status: (input.status as "Draft" | "Sent") || "Draft",
        ...totals,
        discountPercent: input.discountPercent ?? null,
        taxRate: input.taxRate ?? null,
        notes: input.notes,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        items: {
          create: input.items.map((item) => ({
            clinicId: user.clinicId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: Math.round(item.quantity * item.unitPrice * 100) / 100,
            serviceId: item.serviceId || null,
          })),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "InvoiceCreate",
        entityType: "Invoice",
        entityId: invoice.id,
        details: JSON.stringify({ patientId: input.patientId, invoiceNumber, total: totals.total }),
      },
    });

    revalidatePath("/sales");
    return { success: true as const, data: invoice };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function updateInvoice(id: string, input: InvoiceInput) {
  try {
    const user = await requirePermission("invoices", "edit");

    const existing = await prisma.invoice.findFirst({
      where: { id, clinicId: user.clinicId, deletedAt: null },
    });
    if (!existing) return { success: false as const, error: "Invoice not found" };

    const totals = calculateTotals(input.items, input.discountAmount ?? 0, input.discountPercent ?? null, input.taxRate ?? null);

    // Soft delete existing items and recreate
    await prisma.invoiceItem.updateMany({
      where: { invoiceId: id, clinicId: user.clinicId },
      data: { deletedAt: new Date() },
    });

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        patientId: input.patientId,
        ...totals,
        discountPercent: input.discountPercent ?? null,
        taxRate: input.taxRate ?? null,
        notes: input.notes,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: (input.status as "Draft" | "Sent") || undefined,
        items: {
          create: input.items.map((item) => ({
            clinicId: user.clinicId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: Math.round(item.quantity * item.unitPrice * 100) / 100,
            serviceId: item.serviceId || null,
          })),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "InvoiceUpdate",
        entityType: "Invoice",
        entityId: invoice.id,
        details: JSON.stringify({ invoiceNumber: existing.invoiceNumber, total: totals.total }),
      },
    });

    revalidatePath("/sales");
    return { success: true as const, data: invoice };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function updateInvoiceStatus(id: string, status: string) {
  try {
    const user = await requirePermission("invoices", "edit");

    const existing = await prisma.invoice.findFirst({
      where: { id, clinicId: user.clinicId, deletedAt: null },
    });
    if (!existing) return { success: false as const, error: "Invoice not found" };

    await prisma.invoice.update({
      where: { id },
      data: { status: status as "Draft" | "Sent" | "Void" | "Refunded" },
    });

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "InvoiceUpdate",
        entityType: "Invoice",
        entityId: id,
        details: JSON.stringify({ previousStatus: existing.status, newStatus: status }),
      },
    });

    revalidatePath("/sales");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function deleteInvoice(id: string) {
  try {
    const user = await requirePermission("invoices", "delete");

    const existing = await prisma.invoice.findFirst({
      where: { id, clinicId: user.clinicId, deletedAt: null },
    });
    if (!existing) return { success: false as const, error: "Invoice not found" };

    const now = new Date();
    await prisma.$transaction([
      prisma.invoice.update({
        where: { id },
        data: { deletedAt: now },
      }),
      prisma.invoiceItem.updateMany({
        where: { invoiceId: id },
        data: { deletedAt: now },
      }),
      prisma.payment.updateMany({
        where: { invoiceId: id },
        data: { deletedAt: now },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "InvoiceDelete",
        entityType: "Invoice",
        entityId: id,
        details: JSON.stringify({ invoiceNumber: existing.invoiceNumber, total: existing.total }),
      },
    });

    revalidatePath("/sales");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function recordPayment(input: PaymentInput) {
  try {
    const user = await requirePermission("invoices", "edit");

    const invoice = await prisma.invoice.findFirst({
      where: { id: input.invoiceId, clinicId: user.clinicId, deletedAt: null },
      include: { payments: { where: { deletedAt: null }, select: { amount: true } } },
    });
    if (!invoice) return { success: false as const, error: "Invoice not found" };

    const payment = await prisma.payment.create({
      data: {
        clinicId: user.clinicId,
        invoiceId: input.invoiceId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        reference: input.reference || null,
        notes: input.notes || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        clinicId: user.clinicId,
        userId: user.id,
        action: "PaymentCreate",
        entityType: "Payment",
        entityId: payment.id,
        details: JSON.stringify({ invoiceId: input.invoiceId, amount: input.amount, paymentMethod: input.paymentMethod }),
      },
    });

    // Calculate new paid total
    const totalPaid = invoice.payments.reduce((s, p) => s + p.amount, 0) + input.amount;
    let newStatus: string = invoice.status;
    if (totalPaid >= invoice.total) {
      newStatus = "Paid";
    } else if (totalPaid > 0) {
      newStatus = "PartiallyPaid";
    }

    if (newStatus !== invoice.status) {
      await prisma.invoice.update({
        where: { id: input.invoiceId },
        data: {
          status: newStatus as "Paid" | "PartiallyPaid",
          paidAt: newStatus === "Paid" ? new Date() : null,
        },
      });
    }

    revalidatePath("/sales");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false as const, error: error.message };
    throw error;
  }
}

export async function quickCreatePatient(input: { firstName: string; lastName: string; email?: string; phone?: string }) {
  const user = await requirePermission("patients", "create");
  const patient = await prisma.patient.create({
    data: {
      clinicId: user.clinicId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email || null,
      phone: input.phone || null,
    },
  });
  revalidatePath("/patients");
  return { id: patient.id, firstName: patient.firstName, lastName: patient.lastName, email: patient.email, phone: patient.phone, tags: null as string | null };
}

export async function searchPatients(query: string) {
  const user = await requirePermission("patients", "view");
  if (!query || query.length < 2) return [];
  const q = query.trim();
  // Use raw query for case-insensitive search on SQLite
  const patients = await prisma.$queryRaw<
    { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; tags: string | null }[]
  >`
    SELECT id, firstName, lastName, email, phone, tags
    FROM Patient
    WHERE clinicId = ${user.clinicId}
      AND deletedAt IS NULL
      AND (firstName LIKE ${'%' + q + '%'} OR lastName LIKE ${'%' + q + '%'} OR (firstName || ' ' || lastName) LIKE ${'%' + q + '%'})
    LIMIT 10
  `;
  return patients;
}

export type ClinicInfo = {
  name: string;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  defaultTaxRate: number | null;
};

export async function getClinicInfo(): Promise<ClinicInfo> {
  const user = await requirePermission("invoices", "view");
  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: user.clinicId },
    select: { name: true, logoUrl: true, address: true, city: true, state: true, zipCode: true, phone: true, email: true, website: true, defaultTaxRate: true },
  });
  return clinic;
}
