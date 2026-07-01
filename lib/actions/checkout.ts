"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  buildCheckoutData,
  type CheckoutData,
} from "@/lib/services/checkout";
import { redeemSession } from "@/lib/services/packages";
import { applyDepositToInvoice } from "@/lib/services/stripe-deposits";

export async function getCheckoutDataAction(
  invoiceId: string
): Promise<CheckoutData> {
  const user = await requirePermission("invoices", "view");
  return buildCheckoutData(user.clinicId, invoiceId);
}

export async function updateGratuityAction(
  invoiceId: string,
  amount: number
): Promise<{ success: true; gratuityAmount: number; total: number } | { success: false; error: string }> {
  try {
    const user = await requirePermission("invoices", "edit");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, clinicId: user.clinicId, deletedAt: null },
    });
    if (!invoice) return { success: false, error: "Invoice not found" };

    const gratuityAmount = Math.max(0, Math.round(amount * 100) / 100);
    // Recalculate total: (subtotal - discount) + tax + gratuity
    const baseTotal = invoice.subtotal - invoice.discountAmount + invoice.taxAmount;
    const newTotal = Math.round((baseTotal + gratuityAmount) * 100) / 100;

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { gratuityAmount, total: newTotal },
    });

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "InvoiceUpdate",
      entityType: "Invoice",
      entityId: invoiceId,
      details: JSON.stringify({ gratuityAmount }),
    });

    revalidatePath("/sales");
    return { success: true, gratuityAmount, total: newTotal };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    throw error;
  }
}

export async function redeemPackageForCheckoutAction(
  invoiceId: string,
  invoiceItemId: string,
  patientPackageId: string,
  serviceId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requirePermission("invoices", "edit");

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, clinicId: user.clinicId, deletedAt: null },
    });
    if (!invoice) return { success: false, error: "Invoice not found" };

    await redeemSession(user.clinicId, {
      patientPackageId,
      serviceId,
      redeemedById: user.id,
      notes: `Redeemed at checkout for invoice ${invoice.invoiceNumber}`,
    });

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "InvoiceUpdate",
      entityType: "Invoice",
      entityId: invoiceId,
      details: JSON.stringify({ invoiceItemId, patientPackageId, serviceId }),
    });

    revalidatePath("/sales");
    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    if (error instanceof Error) return { success: false, error: error.message };
    throw error;
  }
}

export async function applyDepositAction(
  invoiceId: string,
  depositPaymentId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requirePermission("invoices", "edit");

    await applyDepositToInvoice(user.clinicId, depositPaymentId, invoiceId);

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "StripeDepositApply",
      entityType: "Invoice",
      entityId: invoiceId,
      details: JSON.stringify({ depositPaymentId }),
    });

    revalidatePath("/sales");
    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    if (error instanceof Error) return { success: false, error: error.message };
    throw error;
  }
}

export async function createInvoiceFromAppointmentAction(
  appointmentId: string
): Promise<{ success: true; invoiceId: string } | { success: false; error: string }> {
  try {
    const user = await requirePermission("invoices", "create");

    // Check if invoice already exists for this appointment
    const existing = await prisma.invoice.findFirst({
      where: { appointmentId, clinicId: user.clinicId, deletedAt: null },
    });
    if (existing) return { success: true, invoiceId: existing.id };

    const appointment = await prisma.appointment.findFirstOrThrow({
      where: { id: appointmentId, clinicId: user.clinicId, deletedAt: null },
      include: {
        service: { select: { id: true, name: true, price: true } },
      },
    });

    if (!appointment.patientId) {
      return { success: false, error: "Appointment has no patient" };
    }

    // Generate invoice number
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `INV-${dateStr}-`;
    const lastInvoice = await prisma.invoice.findFirst({
      where: { clinicId: user.clinicId, invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });
    let seq = 1;
    if (lastInvoice) {
      const lastSeq = parseInt(lastInvoice.invoiceNumber.split("-").pop() || "0", 10);
      seq = lastSeq + 1;
    }
    const invoiceNumber = `${prefix}${String(seq).padStart(3, "0")}`;

    // Get clinic default tax rate
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: user.clinicId },
      select: { defaultTaxRate: true },
    });

    const price = appointment.service?.price ?? 0;
    const taxRate = clinic.defaultTaxRate ?? 0;
    const taxAmount = taxRate > 0 ? Math.round(price * (taxRate / 100) * 100) / 100 : 0;
    const total = Math.round((price + taxAmount) * 100) / 100;

    const invoice = await prisma.invoice.create({
      data: {
        clinicId: user.clinicId,
        patientId: appointment.patientId,
        appointmentId,
        invoiceNumber,
        status: "Sent",
        subtotal: price,
        taxAmount,
        taxRate: taxRate > 0 ? taxRate : null,
        total,
        items: appointment.service
          ? {
              create: {
                clinicId: user.clinicId,
                serviceId: appointment.service.id,
                description: appointment.service.name,
                quantity: 1,
                unitPrice: appointment.service.price,
                total: appointment.service.price,
              },
            }
          : undefined,
      },
    });

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "InvoiceCreate",
      entityType: "Invoice",
      entityId: invoice.id,
      details: JSON.stringify({ appointmentId, invoiceNumber, total }),
    });

    revalidatePath("/sales");
    return { success: true, invoiceId: invoice.id };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    if (error instanceof Error) return { success: false, error: error.message };
    throw error;
  }
}
