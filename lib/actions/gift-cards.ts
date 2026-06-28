"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { validateInput } from "@/lib/validation/helpers";
import { issueGiftCardSchema } from "@/lib/validation/schemas";
import { revalidatePath } from "next/cache";
import { maskCode, formatGiftCardCode } from "@/lib/utils/gift-card-code";
import {
  issueGiftCard,
  getGiftCards,
  voidGiftCard,
  getGiftCardDenominations,
  updateDenominations,
  redeemGiftCardToWallet,
  type GiftCardFilters,
} from "@/lib/services/gift-cards";
import { sendGiftCardEmail } from "@/lib/services/gift-card-notifications";

export type ActionResult<T = void> = {
  success: true;
  data?: T;
} | {
  success: false;
  error: string;
};

export type GiftCardListItem = {
  id: string;
  code: string;
  maskedCode: string;
  originalAmount: number;
  remainingBalance: number;
  status: string;
  buyerName: string | null;
  recipientName: string | null;
  isGift: boolean;
  expiresAt: Date;
  createdAt: Date;
};

export type GiftCardDetail = GiftCardListItem & {
  code: string;
  formattedCode: string;
  buyerEmail: string | null;
  recipientEmail: string | null;
  giftMessage: string | null;
  purchasedById: string | null;
  buyerPatientId: string | null;
  recipientPatientId: string | null;
  linkedAt: Date | null;
};

export async function getGiftCardsList(filters?: GiftCardFilters): Promise<GiftCardListItem[]> {
  const user = await requirePermission("giftCards", "view");

  const giftCards = await getGiftCards(user.clinicId, filters);

  return giftCards.map((gc) => ({
    id: gc.id,
    code: gc.code,
    maskedCode: maskCode(gc.code),
    originalAmount: gc.originalAmount,
    remainingBalance: gc.remainingBalance,
    status: gc.status,
    buyerName: gc.buyerName || (gc.buyerPatient ? `${gc.buyerPatient.firstName} ${gc.buyerPatient.lastName}` : null),
    recipientName: gc.recipientName || (gc.recipientPatient ? `${gc.recipientPatient.firstName} ${gc.recipientPatient.lastName}` : null),
    isGift: gc.isGift,
    expiresAt: gc.expiresAt,
    createdAt: gc.createdAt,
  }));
}

export async function getGiftCardDetail(id: string): Promise<ActionResult<GiftCardDetail>> {
  const user = await requirePermission("giftCards", "view");

  const gc = await prisma.giftCard.findFirst({
    where: { id, clinicId: user.clinicId },
    include: {
      buyerPatient: { select: { firstName: true, lastName: true } },
      recipientPatient: { select: { firstName: true, lastName: true } },
    },
  });

  if (!gc) return { success: false, error: "Gift card not found" };

  await createAuditLog({
    clinicId: user.clinicId,
    userId: user.id,
    action: "GiftCardView",
    entityType: "GiftCard",
    entityId: gc.id,
  });

  return {
    success: true,
    data: {
      id: gc.id,
      maskedCode: maskCode(gc.code),
      code: gc.code,
      formattedCode: formatGiftCardCode(gc.code),
      originalAmount: gc.originalAmount,
      remainingBalance: gc.remainingBalance,
      status: gc.status,
      buyerName: gc.buyerName || (gc.buyerPatient ? `${gc.buyerPatient.firstName} ${gc.buyerPatient.lastName}` : null),
      recipientName: gc.recipientName || (gc.recipientPatient ? `${gc.recipientPatient.firstName} ${gc.recipientPatient.lastName}` : null),
      isGift: gc.isGift,
      expiresAt: gc.expiresAt,
      createdAt: gc.createdAt,
      buyerEmail: gc.buyerEmail,
      recipientEmail: gc.recipientEmail,
      giftMessage: gc.giftMessage,
      purchasedById: gc.purchasedById,
      buyerPatientId: gc.buyerPatientId,
      recipientPatientId: gc.recipientPatientId,
      linkedAt: gc.linkedAt,
    },
  };
}

export async function issueGiftCardAction(input: {
  amount: number;
  isGift: boolean;
  buyerPatientId?: string;
  buyerName?: string;
  buyerEmail?: string;
  recipientName?: string;
  recipientEmail?: string;
  giftMessage?: string;
}): Promise<ActionResult<{ id: string; formattedCode: string }>> {
  try {
    const user = await requirePermission("giftCards", "create");
    validateInput(issueGiftCardSchema, input);

    const giftCard = await issueGiftCard({
      clinicId: user.clinicId,
      purchasedById: user.id,
      ...input,
    });

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "GiftCardCreate",
      entityType: "GiftCard",
      entityId: giftCard.id,
      details: JSON.stringify({ amount: input.amount, isGift: input.isGift }),
    });

    // Send gift email if applicable
    if (input.isGift && input.recipientEmail) {
      await sendGiftCardEmail({
        code: giftCard.code,
        amount: giftCard.originalAmount,
        buyerName: input.buyerName || null,
        recipientName: input.recipientName || null,
        recipientEmail: input.recipientEmail,
        expiresAt: giftCard.expiresAt,
      });
    }

    revalidatePath("/sales");
    return {
      success: true,
      data: { id: giftCard.id, formattedCode: formatGiftCardCode(giftCard.code) },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to issue gift card" };
  }
}

export async function redeemGiftCardAction(code: string, patientId: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("giftCards", "edit");

    const entry = await redeemGiftCardToWallet(user.clinicId, code, patientId);

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "GiftCardRedeem",
      entityType: "GiftCard",
      entityId: entry.giftCardId || "",
      details: JSON.stringify({ patientId, amount: entry.originalAmount }),
    });

    revalidatePath("/sales");
    revalidatePath(`/patients/${patientId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to redeem gift card" };
  }
}

export async function voidGiftCardAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("giftCards", "delete");

    await voidGiftCard(user.clinicId, id);

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "GiftCardVoid",
      entityType: "GiftCard",
      entityId: id,
    });

    revalidatePath("/sales");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to void gift card" };
  }
}

export async function getGiftCardDenominationsAction() {
  const user = await requirePermission("giftCards", "view");
  return getGiftCardDenominations(user.clinicId);
}

export async function updateDenominationsAction(amounts: number[]): Promise<ActionResult> {
  try {
    const user = await requirePermission("giftCards", "edit");
    await updateDenominations(user.clinicId, amounts);
    revalidatePath("/sales");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update denominations" };
  }
}

export async function getGiftCardStats() {
  const user = await requirePermission("giftCards", "view");
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [activeCards, outstandingBalance, expiredThisMonth] = await Promise.all([
    prisma.giftCard.count({ where: { clinicId: user.clinicId, status: "Active" } }),
    prisma.giftCard.aggregate({
      where: { clinicId: user.clinicId, status: "Active" },
      _sum: { remainingBalance: true },
    }),
    prisma.giftCard.count({
      where: {
        clinicId: user.clinicId,
        status: "Expired",
        expiresAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  return {
    activeCards,
    outstandingBalance: outstandingBalance._sum.remainingBalance || 0,
    expiredThisMonth,
  };
}
