import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expireGiftCards } from "@/lib/services/gift-cards";

export async function GET(request: Request) {
  // Auth check
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Expire overdue gift cards
  const expired = await expireGiftCards();

  // 2. Find patients with wallet balance who haven't been reminded in 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const now = new Date();

  const entriesWithBalance = await prisma.walletEntry.findMany({
    where: {
      remainingBalance: { gt: 0 },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    include: {
      patient: {
        include: {
          communicationPreference: true,
        },
      },
      giftCard: { select: { lastReminderSentAt: true, id: true } },
    },
  });

  // Group by patient
  const patientBalances = new Map<string, {
    patientId: string;
    patientName: string;
    clinicId: string;
    balance: number;
    giftCardIds: string[];
    smsOptIn: boolean;
    lastReminded: Date | null;
  }>();

  for (const entry of entriesWithBalance) {
    const existing = patientBalances.get(entry.patientId);
    const lastReminded = entry.giftCard?.lastReminderSentAt || null;

    if (existing) {
      existing.balance += entry.remainingBalance;
      if (entry.giftCardId && !existing.giftCardIds.includes(entry.giftCardId)) {
        existing.giftCardIds.push(entry.giftCardId);
      }
      if (lastReminded && (!existing.lastReminded || lastReminded > existing.lastReminded)) {
        existing.lastReminded = lastReminded;
      }
    } else {
      patientBalances.set(entry.patientId, {
        patientId: entry.patientId,
        patientName: `${entry.patient.firstName}`,
        clinicId: entry.clinicId,
        balance: entry.remainingBalance,
        giftCardIds: entry.giftCardId ? [entry.giftCardId] : [],
        smsOptIn: entry.patient.communicationPreference?.smsOptIn ?? false,
        lastReminded: lastReminded,
      });
    }
  }

  let reminded = 0;
  let skipped = 0;

  for (const data of patientBalances.values()) {
    // Skip if reminded within 30 days
    if (data.lastReminded && data.lastReminded > thirtyDaysAgo) {
      skipped++;
      continue;
    }

    // Skip if no SMS opt-in
    if (!data.smsOptIn) {
      skipped++;
      continue;
    }

    // Stub: log reminder (no SMS provider wired yet for this specific use case)
    console.log(
      `[GiftCard Reminder] ${data.patientName}: $${data.balance.toFixed(2)} balance at clinic ${data.clinicId}`
    );

    // Update lastReminderSentAt on all related gift cards
    if (data.giftCardIds.length > 0) {
      await prisma.giftCard.updateMany({
        where: { id: { in: data.giftCardIds } },
        data: { lastReminderSentAt: now },
      });
    }

    reminded++;
  }

  return NextResponse.json({
    expired,
    reminded,
    skipped,
  });
}
