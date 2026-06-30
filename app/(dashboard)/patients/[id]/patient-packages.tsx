"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PackageIcon,
  Loader2Icon,
} from "lucide-react";
import {
  sellPackageAction,
  cancelPatientPackageAction,
  redeemSessionAction,
} from "@/lib/actions/packages";
import {
  type PackageWithItems,
  type PatientPackageWithProgress,
} from "@/lib/services/packages";

type Props = {
  patientId: string;
  packages: PatientPackageWithProgress[];
  availablePackages: PackageWithItems[];
  canManage: boolean;
};

const STATUS_STYLES: Record<string, string> = {
  Active: "bg-green-50 text-green-700",
  Completed: "bg-blue-50 text-blue-700",
  Expired: "bg-red-50 text-red-700",
  Cancelled: "bg-gray-100 text-gray-500",
};

export function PatientPackages({ patientId, packages, availablePackages, canManage }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSellForm, setShowSellForm] = useState(false);

  // Sell form state
  const [sellPackageId, setSellPackageId] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellNotes, setSellNotes] = useState("");

  // Redeem state
  const [redeemingItem, setRedeemingItem] = useState<{ ppId: string; serviceId: string } | null>(null);
  const [redeemNotes, setRedeemNotes] = useState("");

  const activeCount = packages.filter((p) => p.status === "Active").length;
  const totalRemaining = packages
    .filter((p) => p.status === "Active")
    .reduce((sum, p) => sum + p.items.reduce((s, i) => s + i.remainingQuantity, 0), 0);

  function handleSell() {
    if (!sellPackageId) return;
    setError(null);
    const pkg = availablePackages.find((p) => p.id === sellPackageId);
    const price = sellPrice ? parseFloat(sellPrice) : undefined;

    startTransition(async () => {
      const result = await sellPackageAction({
        patientId,
        packageId: sellPackageId,
        purchasePrice: price ?? pkg?.packagePrice,
        notes: sellNotes.trim() || undefined,
      });
      if (!result.success) {
        setError(result.error);
      } else {
        setShowSellForm(false);
        setSellPackageId("");
        setSellPrice("");
        setSellNotes("");
        router.refresh();
      }
    });
  }

  function handleRedeem(ppId: string, serviceId: string) {
    setError(null);
    startTransition(async () => {
      const result = await redeemSessionAction(
        { patientPackageId: ppId, serviceId, notes: redeemNotes.trim() || undefined },
        patientId
      );
      if (!result.success) {
        setError(result.error);
      } else {
        setRedeemingItem(null);
        setRedeemNotes("");
        router.refresh();
      }
    });
  }

  function handleCancel(ppId: string) {
    setError(null);
    startTransition(async () => {
      const result = await cancelPatientPackageAction(ppId, patientId);
      if (!result.success) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  // When sell package selected, auto-fill price
  function onSellPackageChange(id: string) {
    setSellPackageId(id);
    const pkg = availablePackages.find((p) => p.id === id);
    setSellPrice(pkg ? pkg.packagePrice.toString() : "");
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {activeCount > 0 ? (
            <>
              <span className="font-semibold text-gray-900">{activeCount}</span> active package{activeCount !== 1 ? "s" : ""}
              {" | "}
              <span className="font-semibold text-gray-900">{totalRemaining}</span> session{totalRemaining !== 1 ? "s" : ""} remaining
            </>
          ) : (
            "No active packages"
          )}
        </div>
        {canManage && availablePackages.length > 0 && (
          <button
            onClick={() => setShowSellForm(!showSellForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
          >
            <PackageIcon className="h-4 w-4" />
            Sell Package
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Sell form */}
      {showSellForm && (
        <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4 space-y-3">
          <div className="text-sm font-medium text-gray-900">Sell Package</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Package *</label>
              <select
                value={sellPackageId}
                onChange={(e) => onSellPackageChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="">Select package...</option>
                {availablePackages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ${p.packagePrice.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Price Override</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                placeholder="Default price"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <input
              type="text"
              value={sellNotes}
              onChange={(e) => setSellNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="Optional notes"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSell}
              disabled={!sellPackageId || isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isPending && <Loader2Icon className="h-4 w-4 animate-spin" />}
              Confirm Sale
            </button>
            <button
              onClick={() => setShowSellForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Package cards */}
      {packages.length === 0 && !showSellForm && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <PackageIcon className="size-8 mb-2" />
          <p className="text-sm">No packages yet</p>
        </div>
      )}

      <div className="space-y-4">
        {packages.map((pp) => {
          const isExpanded = expandedId === pp.id;
          return (
            <div key={pp.id} className="rounded-lg border border-gray-200 overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : pp.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 text-left"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{pp.packageName}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[pp.status] || "bg-gray-100 text-gray-500"}`}>
                        {pp.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Purchased {pp.purchasedAt.toLocaleDateString()}
                      {pp.expiresAt && ` | Expires ${pp.expiresAt.toLocaleDateString()}`}
                      {" | "}Paid ${pp.purchasePrice.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {pp.overallProgress}% used
                </div>
              </button>

              {/* Item progress rows */}
              <div className="px-4 pb-3 space-y-2">
                {pp.items.map((item) => {
                  const pct = item.totalQuantity > 0
                    ? Math.round((item.redeemedQuantity / item.totalQuantity) * 100)
                    : 0;
                  const isDone = item.remainingQuantity === 0;
                  const isRedeemingThis =
                    redeemingItem?.ppId === pp.id && redeemingItem?.serviceId === item.serviceId;
                  return (
                    <div key={item.serviceId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{item.serviceName}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${isDone ? "text-green-600" : "text-gray-500"}`}>
                            {item.redeemedQuantity}/{item.totalQuantity}
                            {isDone ? " (done)" : ` (${item.remainingQuantity} remaining)`}
                          </span>
                          {canManage && pp.status === "Active" && !isDone && !isRedeemingThis && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRedeemingItem({ ppId: pp.id, serviceId: item.serviceId });
                                setRedeemNotes("");
                              }}
                              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                            >
                              Redeem
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isDone ? "bg-green-500" : "bg-purple-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {/* Inline redeem form */}
                      {isRedeemingThis && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={redeemNotes}
                            onChange={(e) => setRedeemNotes(e.target.value)}
                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs focus:border-purple-500 focus:outline-none"
                            placeholder="Notes (optional)"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRedeem(pp.id, item.serviceId);
                            }}
                            disabled={isPending}
                            className="rounded bg-purple-600 px-2 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                          >
                            {isPending ? "..." : "Confirm"}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRedeemingItem(null);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Expanded: redemption history + cancel */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
                  {pp.notes && (
                    <div className="text-xs text-gray-500 mb-3">
                      <span className="font-medium">Notes:</span> {pp.notes}
                    </div>
                  )}

                  {pp.redemptions.length > 0 && (
                    <div className="space-y-1 mb-3">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Redemption History
                      </div>
                      {pp.redemptions.map((r) => (
                        <div key={r.id} className="flex items-center justify-between text-xs text-gray-600">
                          <div>
                            <span className="font-medium">{r.serviceName}</span>
                            {r.quantity > 1 && ` x${r.quantity}`}
                            {" — "}
                            {r.redeemedByName}
                            {r.notes && (
                              <span className="text-gray-400"> ({r.notes})</span>
                            )}
                          </div>
                          <div className="text-gray-400">
                            {new Date(r.redeemedAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {pp.redemptions.length === 0 && (
                    <div className="text-xs text-gray-400 mb-3">No redemptions yet</div>
                  )}

                  {canManage && pp.status === "Active" && (
                    <button
                      onClick={() => handleCancel(pp.id)}
                      disabled={isPending}
                      className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      Cancel Package
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
