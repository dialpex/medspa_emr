"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { validateInput } from "@/lib/validation/helpers";
import { walletPaymentSchema, storeCreditSchema } from "@/lib/validation/schemas";
import { revalidatePath } from "next/cache";
import {
  getWalletBalance,
  getWalletEntries,
  debitWalletFIFO,
  creditWallet,
} from "@/lib/services/wallet";

export type ActionResult<T = void> = {
  success: true;
  data?: T;
} | {
  success: false;
  error: string;
};

export type WalletData = {
  totalBalance: number;
  entries: {
    id: string;
    source: string;
    description: string;
    originalAmount: number;
    remainingBalance: number;
    expiresAt: Date | null;
    createdAt: Date;
    giftCard: { code: string; status: string } | null;
    transactions: {
      id: string;
      amount: number;
      balanceAfter: number;
      description: string;
      createdAt: Date;
    }[];
  }[];
};

export async function getPatientWallet(patientId: string): Promise<WalletData> {
  const user = await requirePermission("patients", "view");

  const [totalBalance, entries] = await Promise.all([
    getWalletBalance(user.clinicId, patientId),
    getWalletEntries(user.clinicId, patientId),
  ]);

  await createAuditLog({
    clinicId: user.clinicId,
    userId: user.id,
    action: "WalletView",
    entityType: "Patient",
    entityId: patientId,
  });

  return { totalBalance, entries };
}

export async function payWithWallet(invoiceId: string, amount: number): Promise<ActionResult> {
  try {
    const user = await requirePermission("invoices", "edit");
    validateInput(walletPaymentSchema, { invoiceId, amount });

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, clinicId: user.clinicId, deletedAt: null },
      include: { payments: { where: { deletedAt: null }, select: { amount: true } } },
    });
    if (!invoice) return { success: false, error: "Invoice not found" };

    const balance = await getWalletBalance(user.clinicId, invoice.patientId);
    if (balance < amount) {
      return { success: false, error: `Insufficient wallet balance. Available: $${balance.toFixed(2)}` };
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        clinicId: user.clinicId,
        invoiceId,
        amount,
        paymentMethod: "Wallet",
      },
    });

    // Debit wallet FIFO
    await debitWalletFIFO(
      user.clinicId,
      invoice.patientId,
      amount,
      payment.id,
      `Payment for invoice ${invoice.invoiceNumber}`
    );

    // Update invoice status
    const totalPaid = invoice.payments.reduce((s, p) => s + p.amount, 0) + amount;
    let newStatus: string = invoice.status;
    if (totalPaid >= invoice.total) {
      newStatus = "Paid";
    } else if (totalPaid > 0) {
      newStatus = "PartiallyPaid";
    }

    if (newStatus !== invoice.status) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: newStatus as "Paid" | "PartiallyPaid",
          paidAt: newStatus === "Paid" ? new Date() : null,
        },
      });
    }

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "WalletDebit",
      entityType: "Invoice",
      entityId: invoiceId,
      details: JSON.stringify({ amount, patientId: invoice.patientId }),
    });

    revalidatePath("/sales");
    revalidatePath(`/patients/${invoice.patientId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to process wallet payment" };
  }
}

export async function issueStoreCreditAction(input: {
  patientId: string;
  amount: number;
  description: string;
}): Promise<ActionResult> {
  try {
    const user = await requirePermission("giftCards", "create");
    validateInput(storeCreditSchema, input);

    await creditWallet({
      clinicId: user.clinicId,
      patientId: input.patientId,
      amount: input.amount,
      description: input.description,
    });

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "WalletCredit",
      entityType: "Patient",
      entityId: input.patientId,
      details: JSON.stringify({ amount: input.amount, description: input.description }),
    });

    revalidatePath(`/patients/${input.patientId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to issue store credit" };
  }
}

export async function getWalletBalanceAction(patientId: string): Promise<number> {
  const user = await requirePermission("patients", "view");
  return getWalletBalance(user.clinicId, patientId);
}
