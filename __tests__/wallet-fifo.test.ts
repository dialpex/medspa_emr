import { describe, it, expect, beforeEach } from "vitest";

// Inline FIFO logic to test without Prisma deps
type MockEntry = {
  id: string;
  remainingBalance: number;
  expiresAt: Date | null;
  createdAt: Date;
  giftCardId: string | null;
};

type MockTransaction = {
  walletEntryId: string;
  amount: number;
  balanceAfter: number;
};

function debitFIFO(entries: MockEntry[], amount: number): { transactions: MockTransaction[]; updatedEntries: MockEntry[] } {
  const now = new Date();

  // Filter valid entries
  const valid = entries
    .filter((e) => e.remainingBalance > 0 && (e.expiresAt === null || e.expiresAt > now))
    .sort((a, b) => {
      if (a.expiresAt && b.expiresAt) return a.expiresAt.getTime() - b.expiresAt.getTime();
      if (a.expiresAt && !b.expiresAt) return -1;
      if (!a.expiresAt && b.expiresAt) return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

  const totalAvailable = valid.reduce((sum, e) => sum + e.remainingBalance, 0);
  if (totalAvailable < amount) {
    throw new Error(`Insufficient balance: ${totalAvailable} < ${amount}`);
  }

  let remaining = amount;
  const transactions: MockTransaction[] = [];
  const updated = [...entries];

  for (const entry of valid) {
    if (remaining <= 0) break;
    const deduction = Math.min(entry.remainingBalance, remaining);
    const newBalance = Math.round((entry.remainingBalance - deduction) * 100) / 100;

    const idx = updated.findIndex((e) => e.id === entry.id);
    updated[idx] = { ...entry, remainingBalance: newBalance };

    transactions.push({
      walletEntryId: entry.id,
      amount: -deduction,
      balanceAfter: newBalance,
    });

    remaining = Math.round((remaining - deduction) * 100) / 100;
  }

  return { transactions, updatedEntries: updated };
}

describe("Wallet FIFO Deduction", () => {
  const now = new Date();
  const future30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const future60d = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  it("deducts from soonest-expiring entry first", () => {
    const entries: MockEntry[] = [
      { id: "a", remainingBalance: 50, expiresAt: future60d, createdAt: now, giftCardId: null },
      { id: "b", remainingBalance: 30, expiresAt: future30d, createdAt: now, giftCardId: null },
    ];

    const { transactions } = debitFIFO(entries, 25);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].walletEntryId).toBe("b"); // 30d expires first
    expect(transactions[0].amount).toBe(-25);
    expect(transactions[0].balanceAfter).toBe(5);
  });

  it("handles partial deduction across multiple entries", () => {
    const entries: MockEntry[] = [
      { id: "a", remainingBalance: 20, expiresAt: future30d, createdAt: now, giftCardId: null },
      { id: "b", remainingBalance: 40, expiresAt: future60d, createdAt: now, giftCardId: null },
    ];

    const { transactions } = debitFIFO(entries, 35);
    expect(transactions).toHaveLength(2);
    expect(transactions[0]).toEqual({ walletEntryId: "a", amount: -20, balanceAfter: 0 });
    expect(transactions[1]).toEqual({ walletEntryId: "b", amount: -15, balanceAfter: 25 });
  });

  it("skips expired entries", () => {
    const entries: MockEntry[] = [
      { id: "expired", remainingBalance: 100, expiresAt: past, createdAt: now, giftCardId: null },
      { id: "valid", remainingBalance: 50, expiresAt: future30d, createdAt: now, giftCardId: null },
    ];

    const { transactions } = debitFIFO(entries, 30);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].walletEntryId).toBe("valid");
  });

  it("uses non-expiring entries last", () => {
    const entries: MockEntry[] = [
      { id: "no-expiry", remainingBalance: 100, expiresAt: null, createdAt: now, giftCardId: null },
      { id: "expiring", remainingBalance: 50, expiresAt: future30d, createdAt: now, giftCardId: null },
    ];

    const { transactions } = debitFIFO(entries, 40);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].walletEntryId).toBe("expiring");
  });

  it("throws when insufficient balance", () => {
    const entries: MockEntry[] = [
      { id: "a", remainingBalance: 20, expiresAt: future30d, createdAt: now, giftCardId: null },
    ];

    expect(() => debitFIFO(entries, 50)).toThrow("Insufficient balance");
  });

  it("handles exact full consumption", () => {
    const entries: MockEntry[] = [
      { id: "a", remainingBalance: 30, expiresAt: future30d, createdAt: now, giftCardId: null },
      { id: "b", remainingBalance: 20, expiresAt: future60d, createdAt: now, giftCardId: null },
    ];

    const { transactions, updatedEntries } = debitFIFO(entries, 50);
    expect(transactions).toHaveLength(2);
    expect(updatedEntries.find((e) => e.id === "a")!.remainingBalance).toBe(0);
    expect(updatedEntries.find((e) => e.id === "b")!.remainingBalance).toBe(0);
  });

  it("among non-expiring entries, uses oldest first", () => {
    const older = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const entries: MockEntry[] = [
      { id: "newer", remainingBalance: 50, expiresAt: null, createdAt: now, giftCardId: null },
      { id: "older", remainingBalance: 50, expiresAt: null, createdAt: older, giftCardId: null },
    ];

    const { transactions } = debitFIFO(entries, 30);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].walletEntryId).toBe("older");
  });
});
