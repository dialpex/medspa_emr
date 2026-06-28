import { prisma } from "@/lib/prisma";
import { generateGiftCardCode, formatGiftCardCode, normalizeCode } from "@/lib/utils/gift-card-code";

export type IssueGiftCardInput = {
  clinicId: string;
  amount: number;
  isGift: boolean;
  purchasedById?: string;
  buyerPatientId?: string;
  buyerName?: string;
  buyerEmail?: string;
  recipientName?: string;
  recipientEmail?: string;
  giftMessage?: string;
};

export type GiftCardFilters = {
  status?: string;
  search?: string;
};

export async function issueGiftCard(input: IssueGiftCardInput) {
  // Generate unique code with retry
  let code = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const candidate = generateGiftCardCode();
    const existing = await prisma.giftCard.findUnique({ where: { code: candidate } });
    if (!existing) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new Error("Failed to generate unique gift card code");

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const giftCard = await prisma.giftCard.create({
    data: {
      clinicId: input.clinicId,
      code,
      originalAmount: input.amount,
      remainingBalance: input.amount,
      expiresAt,
      purchasedById: input.purchasedById,
      buyerPatientId: input.buyerPatientId,
      buyerName: input.buyerName,
      buyerEmail: input.buyerEmail,
      isGift: input.isGift,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      giftMessage: input.giftMessage,
    },
  });

  // Self-purchase: auto-create wallet entry for buyer
  if (!input.isGift && input.buyerPatientId) {
    await prisma.walletEntry.create({
      data: {
        clinicId: input.clinicId,
        patientId: input.buyerPatientId,
        source: "GiftCard",
        giftCardId: giftCard.id,
        description: `Gift card ${formatGiftCardCode(code)}`,
        originalAmount: input.amount,
        remainingBalance: input.amount,
        expiresAt,
      },
    });

    await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: {
        recipientPatientId: input.buyerPatientId,
        linkedAt: new Date(),
      },
    });
  }

  return giftCard;
}

export async function getGiftCards(clinicId: string, filters?: GiftCardFilters) {
  const where: Record<string, unknown> = { clinicId };
  if (filters?.status && filters.status !== "All") {
    where.status = filters.status;
  }

  const giftCards = await prisma.giftCard.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      buyerPatient: { select: { firstName: true, lastName: true } },
      recipientPatient: { select: { firstName: true, lastName: true } },
      purchasedBy: { select: { name: true } },
    },
  });

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    return giftCards.filter((gc) => {
      const codeLower = gc.code.toLowerCase();
      const buyerName = gc.buyerName?.toLowerCase() || "";
      const recipientName = gc.recipientName?.toLowerCase() || "";
      return codeLower.includes(q) || buyerName.includes(q) || recipientName.includes(q);
    });
  }

  return giftCards;
}

export async function getGiftCardByCode(clinicId: string, rawCode: string) {
  const code = normalizeCode(rawCode);
  return prisma.giftCard.findFirst({
    where: { clinicId, code },
    include: {
      buyerPatient: { select: { firstName: true, lastName: true } },
      recipientPatient: { select: { firstName: true, lastName: true } },
    },
  });
}

export async function redeemGiftCardToWallet(
  clinicId: string,
  rawCode: string,
  patientId: string
) {
  const code = normalizeCode(rawCode);
  const giftCard = await prisma.giftCard.findFirst({ where: { clinicId, code } });

  if (!giftCard) throw new Error("Gift card not found");
  if (giftCard.status !== "Active") throw new Error(`Gift card is ${giftCard.status.toLowerCase()}`);
  if (giftCard.expiresAt < new Date()) throw new Error("Gift card has expired");
  if (giftCard.remainingBalance <= 0) throw new Error("Gift card has no remaining balance");

  const walletEntry = await prisma.walletEntry.create({
    data: {
      clinicId,
      patientId,
      source: "GiftCard",
      giftCardId: giftCard.id,
      description: `Gift card ${formatGiftCardCode(code)}`,
      originalAmount: giftCard.remainingBalance,
      remainingBalance: giftCard.remainingBalance,
      expiresAt: giftCard.expiresAt,
    },
  });

  await prisma.giftCard.update({
    where: { id: giftCard.id },
    data: {
      recipientPatientId: patientId,
      linkedAt: new Date(),
    },
  });

  return walletEntry;
}

export async function voidGiftCard(clinicId: string, giftCardId: string) {
  const giftCard = await prisma.giftCard.findFirst({ where: { id: giftCardId, clinicId } });
  if (!giftCard) throw new Error("Gift card not found");

  return prisma.giftCard.update({
    where: { id: giftCardId },
    data: { status: "Voided", remainingBalance: 0 },
  });
}

export async function linkGiftCardsByEmail(
  clinicId: string,
  patientId: string,
  email: string
) {
  // SQLite doesn't support case-insensitive mode; use lowercase comparison
  const allUnlinked = await prisma.giftCard.findMany({
    where: {
      clinicId,
      recipientPatientId: null,
      status: "Active",
      recipientEmail: { not: null },
    },
  });
  const emailLower = email.toLowerCase();
  const unlinked = allUnlinked.filter(
    (gc) => gc.recipientEmail?.toLowerCase() === emailLower
  );

  let linked = 0;
  for (const gc of unlinked) {
    await prisma.walletEntry.create({
      data: {
        clinicId,
        patientId,
        source: "GiftCard",
        giftCardId: gc.id,
        description: `Gift card ${formatGiftCardCode(gc.code)}`,
        originalAmount: gc.remainingBalance,
        remainingBalance: gc.remainingBalance,
        expiresAt: gc.expiresAt,
      },
    });

    await prisma.giftCard.update({
      where: { id: gc.id },
      data: { recipientPatientId: patientId, linkedAt: new Date() },
    });

    linked++;
  }

  return linked;
}

export async function expireGiftCards() {
  const result = await prisma.giftCard.updateMany({
    where: {
      status: "Active",
      expiresAt: { lt: new Date() },
    },
    data: { status: "Expired" },
  });
  return result.count;
}

export async function getGiftCardDenominations(clinicId: string) {
  return prisma.giftCardDenomination.findMany({
    where: { clinicId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function updateDenominations(clinicId: string, amounts: number[]) {
  // Deactivate all existing
  await prisma.giftCardDenomination.updateMany({
    where: { clinicId },
    data: { isActive: false },
  });

  // Upsert each amount
  for (let i = 0; i < amounts.length; i++) {
    await prisma.giftCardDenomination.upsert({
      where: { clinicId_amount: { clinicId, amount: amounts[i] } },
      update: { isActive: true, sortOrder: i },
      create: { clinicId, amount: amounts[i], isActive: true, sortOrder: i },
    });
  }
}
