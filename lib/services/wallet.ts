import { prisma } from "@/lib/prisma";

export async function getWalletBalance(clinicId: string, patientId: string) {
  const entries = await prisma.walletEntry.findMany({
    where: {
      clinicId,
      patientId,
      remainingBalance: { gt: 0 },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: { remainingBalance: true },
  });
  return entries.reduce((sum, e) => sum + e.remainingBalance, 0);
}

export async function getWalletEntries(clinicId: string, patientId: string) {
  return prisma.walletEntry.findMany({
    where: { clinicId, patientId },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
    include: {
      transactions: { orderBy: { createdAt: "asc" } },
      giftCard: { select: { code: true, status: true } },
    },
  });
}

export async function debitWalletFIFO(
  clinicId: string,
  patientId: string,
  amount: number,
  paymentId: string | null,
  description: string
) {
  const now = new Date();
  const entries = await prisma.walletEntry.findMany({
    where: {
      clinicId,
      patientId,
      remainingBalance: { gt: 0 },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
  });

  // Sort: expiring entries first (by date), then non-expiring last
  entries.sort((a, b) => {
    if (a.expiresAt && b.expiresAt) return a.expiresAt.getTime() - b.expiresAt.getTime();
    if (a.expiresAt && !b.expiresAt) return -1;
    if (!a.expiresAt && b.expiresAt) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const totalAvailable = entries.reduce((sum, e) => sum + e.remainingBalance, 0);
  if (totalAvailable < amount) {
    throw new Error(`Insufficient wallet balance. Available: $${totalAvailable.toFixed(2)}, requested: $${amount.toFixed(2)}`);
  }

  let remaining = amount;
  const transactions: { walletEntryId: string; amount: number }[] = [];

  for (const entry of entries) {
    if (remaining <= 0) break;

    const deduction = Math.min(entry.remainingBalance, remaining);
    const newBalance = Math.round((entry.remainingBalance - deduction) * 100) / 100;

    await prisma.walletEntry.update({
      where: { id: entry.id },
      data: { remainingBalance: newBalance },
    });

    await prisma.walletTransaction.create({
      data: {
        clinicId,
        walletEntryId: entry.id,
        paymentId,
        amount: -deduction,
        balanceAfter: newBalance,
        description,
      },
    });

    transactions.push({ walletEntryId: entry.id, amount: deduction });

    // Check if parent gift card is fully consumed
    if (entry.giftCardId && newBalance === 0) {
      const otherEntries = await prisma.walletEntry.findMany({
        where: { giftCardId: entry.giftCardId, remainingBalance: { gt: 0 } },
      });
      if (otherEntries.length === 0) {
        await prisma.giftCard.update({
          where: { id: entry.giftCardId },
          data: { status: "Redeemed", remainingBalance: 0 },
        });
      }
    }

    remaining = Math.round((remaining - deduction) * 100) / 100;
  }

  return transactions;
}

export type StoreCreditInput = {
  clinicId: string;
  patientId: string;
  amount: number;
  description: string;
  source?: "StoreCredit" | "Refund";
};

export async function creditWallet(input: StoreCreditInput) {
  const entry = await prisma.walletEntry.create({
    data: {
      clinicId: input.clinicId,
      patientId: input.patientId,
      source: input.source || "StoreCredit",
      description: input.description,
      originalAmount: input.amount,
      remainingBalance: input.amount,
      expiresAt: null,
    },
  });

  await prisma.walletTransaction.create({
    data: {
      clinicId: input.clinicId,
      walletEntryId: entry.id,
      amount: input.amount,
      balanceAfter: input.amount,
      description: `Credit: ${input.description}`,
    },
  });

  return entry;
}
