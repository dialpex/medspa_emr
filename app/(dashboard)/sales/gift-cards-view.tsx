"use client";

import { useState, useTransition } from "react";
import { Gift, Plus, Eye, EyeOff, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGiftCardCode } from "@/lib/utils/gift-card-code";
import { type GiftCardListItem } from "@/lib/actions/gift-cards";
import { IssueGiftCardModal } from "./issue-gift-card-modal";
import { PageCard } from "@/components/ui/page-card";

type Denomination = { id: string; amount: number };

type Props = {
  giftCards: GiftCardListItem[];
  denominations: Denomination[];
  stats: { activeCards: number; outstandingBalance: number; expiredThisMonth: number };
};

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  Active: { bg: "bg-green-100", text: "text-green-700" },
  Redeemed: { bg: "bg-blue-100", text: "text-blue-700" },
  Expired: { bg: "bg-gray-100", text: "text-gray-500" },
  Voided: { bg: "bg-red-100", text: "text-red-700" },
};

export function GiftCardsView({ giftCards, denominations, stats }: Props) {
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [revealedCodes, setRevealedCodes] = useState<Set<string>>(new Set());

  const filtered = giftCards.filter((gc) => {
    if (statusFilter !== "All" && gc.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const maskedLower = gc.maskedCode.toLowerCase();
      const buyerLower = (gc.buyerName || "").toLowerCase();
      const recipientLower = (gc.recipientName || "").toLowerCase();
      if (!maskedLower.includes(q) && !buyerLower.includes(q) && !recipientLower.includes(q)) return false;
    }
    return true;
  });

  function toggleReveal(id: string) {
    setRevealedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <PageCard
      title="Gift Cards"
      headerAction={
        <button
          onClick={() => setShowIssueModal(true)}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          <Plus className="size-4" />
          Issue Gift Card
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="text-sm text-gray-500">Outstanding Balance</div>
          <div className="text-2xl font-semibold text-gray-900">${stats.outstandingBalance.toFixed(2)}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="text-sm text-gray-500">Active Cards</div>
          <div className="text-2xl font-semibold text-gray-900">{stats.activeCards}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="text-sm text-gray-500">Expired This Month</div>
          <div className="text-2xl font-semibold text-gray-900">{stats.expiredThisMonth}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Redeemed">Redeemed</option>
          <option value="Expired">Expired</option>
          <option value="Voided">Voided</option>
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, buyer, or recipient..."
            className="rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm w-72"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Gift className="size-10 mb-3" />
          <p className="text-sm">{giftCards.length === 0 ? "No gift cards issued yet" : "No gift cards match your filters"}</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Code</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Amount</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Balance</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Buyer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Recipient</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((gc) => {
                const badge = STATUS_BADGE[gc.status] || STATUS_BADGE.Active;
                const isExpiringSoon = gc.status === "Active" && gc.expiresAt &&
                  new Date(gc.expiresAt).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
                const isRevealed = revealedCodes.has(gc.id);
                return (
                  <tr key={gc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs">{isRevealed ? formatGiftCardCode(gc.code) : gc.maskedCode}</span>
                        <button
                          onClick={() => toggleReveal(gc.id)}
                          className="rounded p-0.5 text-gray-400 hover:text-gray-600"
                          title={isRevealed ? "Hide code" : "Show code"}
                        >
                          {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">${gc.originalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium">${gc.remainingBalance.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", badge.bg, badge.text)}>
                        {gc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{gc.buyerName || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {gc.recipientName || "—"}
                      {gc.isGift && <span className="ml-1 text-xs text-purple-500">(gift)</span>}
                    </td>
                    <td className={cn("px-4 py-3", isExpiringSoon ? "text-amber-600 font-medium" : "text-gray-600")}>
                      {new Date(gc.expiresAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showIssueModal && (
        <IssueGiftCardModal
          denominations={denominations}
          onClose={() => setShowIssueModal(false)}
        />
      )}
    </PageCard>
  );
}
