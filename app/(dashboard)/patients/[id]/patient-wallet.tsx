"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, CreditCard, Gift, RotateCcw, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { redeemGiftCardAction } from "@/lib/actions/gift-cards";
import { issueStoreCreditAction, type WalletData } from "@/lib/actions/wallet";
import { formatGiftCardCode } from "@/lib/utils/gift-card-code";

type Props = {
  patientId: string;
  wallet: WalletData;
  canManage: boolean;
};

const SOURCE_BADGE: Record<string, { icon: typeof Gift; bg: string; text: string; label: string }> = {
  GiftCard: { icon: Gift, bg: "bg-purple-100", text: "text-purple-700", label: "Gift Card" },
  StoreCredit: { icon: CreditCard, bg: "bg-blue-100", text: "text-blue-700", label: "Store Credit" },
  Refund: { icon: RotateCcw, bg: "bg-amber-100", text: "text-amber-700", label: "Refund" },
};

export function PatientWallet({ patientId, wallet, canManage }: Props) {
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [showRedeem, setShowRedeem] = useState(false);
  const [showStoreCredit, setShowStoreCredit] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Redeem form
  const [redeemCode, setRedeemCode] = useState("");

  // Store credit form
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditDesc, setCreditDesc] = useState("");

  function handleRedeem() {
    if (!redeemCode.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await redeemGiftCardAction(redeemCode, patientId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setShowRedeem(false);
      setRedeemCode("");
    });
  }

  function handleIssueCredit() {
    if (creditAmount <= 0 || !creditDesc.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await issueStoreCreditAction({
        patientId,
        amount: creditAmount,
        description: creditDesc,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setShowStoreCredit(false);
      setCreditAmount(0);
      setCreditDesc("");
    });
  }

  return (
    <div className="space-y-5">
      {/* Balance Summary */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">Available Balance</div>
          <div className={cn("text-3xl font-bold", wallet.totalBalance > 0 ? "text-green-600" : "text-gray-400")}>
            ${wallet.totalBalance.toFixed(2)}
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => { setShowRedeem(true); setShowStoreCredit(false); setError(null); }}
              className="flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
            >
              <Gift className="size-4" />
              Redeem Gift Card
            </button>
            <button
              onClick={() => { setShowStoreCredit(true); setShowRedeem(false); setError(null); }}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus className="size-4" />
              Add Store Credit
            </button>
          </div>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Redeem Modal Inline */}
      {showRedeem && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-purple-900">Redeem Gift Card</h4>
            <button onClick={() => setShowRedeem(false)} className="text-purple-400 hover:text-purple-600">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              className="flex-1 rounded-lg border border-purple-300 px-3 py-2 text-sm font-mono uppercase"
              maxLength={16}
            />
            <button
              onClick={handleRedeem}
              disabled={isPending || !redeemCode.trim()}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {isPending ? "Redeeming..." : "Redeem"}
            </button>
          </div>
        </div>
      )}

      {/* Store Credit Inline */}
      {showStoreCredit && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900">Add Store Credit</h4>
            <button onClick={() => setShowStoreCredit(false)} className="text-gray-400 hover:text-gray-600">
              <X className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={creditAmount || ""}
                onChange={(e) => setCreditAmount(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input
                type="text"
                value={creditDesc}
                onChange={(e) => setCreditDesc(e.target.value)}
                placeholder="e.g., Service adjustment"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleIssueCredit}
            disabled={isPending || creditAmount <= 0 || !creditDesc.trim()}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {isPending ? "Adding..." : "Add Credit"}
          </button>
        </div>
      )}

      {/* Entries */}
      {wallet.entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <CreditCard className="size-8 mb-2" />
          <p className="text-sm">No wallet entries yet</p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {wallet.entries.map((entry) => {
            const source = SOURCE_BADGE[entry.source] || SOURCE_BADGE.StoreCredit;
            const Icon = source.icon;
            const isExpanded = expandedEntry === entry.id;
            const isExpiringSoon = entry.expiresAt &&
              new Date(entry.expiresAt).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000 &&
              new Date(entry.expiresAt).getTime() > Date.now();
            const isExpired = entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now();
            const pct = entry.originalAmount > 0 ? (entry.remainingBalance / entry.originalAmount) * 100 : 0;

            return (
              <div key={entry.id}>
                <button
                  onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", source.bg, source.text)}>
                      <Icon className="size-3" />
                      {source.label}
                    </span>
                    <span className="text-sm text-gray-700 truncate">{entry.description}</span>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {/* Progress bar */}
                    <div className="w-24">
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="text-sm text-right w-24">
                      <span className="font-medium">${entry.remainingBalance.toFixed(2)}</span>
                      <span className="text-gray-400"> / ${entry.originalAmount.toFixed(2)}</span>
                    </div>

                    <div className={cn("text-xs w-24 text-right", isExpired ? "text-red-500" : isExpiringSoon ? "text-amber-600" : "text-gray-400")}>
                      {entry.expiresAt
                        ? (isExpired ? "Expired" : `Exp ${new Date(entry.expiresAt).toLocaleDateString()}`)
                        : "No expiry"}
                    </div>

                    {isExpanded ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && entry.transactions.length > 0 && (
                  <div className="px-4 pb-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="text-left py-1 font-medium">Date</th>
                          <th className="text-left py-1 font-medium">Description</th>
                          <th className="text-right py-1 font-medium">Amount</th>
                          <th className="text-right py-1 font-medium">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {entry.transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="py-1.5 text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</td>
                            <td className="py-1.5 text-gray-700">{tx.description}</td>
                            <td className={cn("py-1.5 text-right font-medium", tx.amount > 0 ? "text-green-600" : "text-red-600")}>
                              {tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(2)}
                            </td>
                            <td className="py-1.5 text-right text-gray-500">${tx.balanceAfter.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
