"use client";

import { useState, useCallback, useTransition } from "react";
import { PatientAvatar } from "@/components/patient-avatar";
import { OrderSummary } from "./order-summary";
import { GratuitySelector } from "./gratuity-selector";
import { PackageCreditSection } from "./package-credit-section";
import { DepositSection } from "./deposit-section";
import { PaymentZone } from "./payment-zone";
import { SplitPaymentTrail } from "./split-payment-trail";
import { CheckoutSuccess } from "./checkout-success";
import {
  calculateCheckoutTotals,
  type CheckoutData,
} from "@/lib/services/checkout-shared";
import type { PackageMatch } from "@/lib/services/packages";
import {
  updateGratuityAction,
  redeemPackageForCheckoutAction,
  applyDepositAction,
  getCheckoutDataAction,
} from "@/lib/actions/checkout";

type CheckoutState = "review" | "success";

type Props = {
  initialData: CheckoutData;
  onClose: () => void;
};

export function CheckoutContent({ initialData, onClose }: Props) {
  const [data, setData] = useState(initialData);
  const [state, setState] = useState<CheckoutState>("review");
  const [error, setError] = useState<string | null>(null);
  const [gratuity, setGratuity] = useState(data.invoice.gratuityAmount);
  const [redeemedItems, setRedeemedItems] = useState<Set<string>>(new Set());
  const [appliedDepositIds, setAppliedDepositIds] = useState<Set<string>>(
    new Set()
  );
  const [isPending, startTransition] = useTransition();
  const [receiptMethod, setReceiptMethod] = useState<"email" | "text">("email");

  const packageCreditsTotal = data.items
    .filter((item) => redeemedItems.has(item.id))
    .reduce((sum, item) => sum + item.total, 0);

  const depositAppliedTotal = data.deposits
    .filter((d) => appliedDepositIds.has(d.id))
    .reduce((sum, d) => sum + d.amount, 0);

  const totalPaid = data.payments
    .filter((p) => p.amount > 0)
    .reduce((sum, p) => sum + p.amount, 0);

  const totals = calculateCheckoutTotals(
    data.invoice.subtotal,
    data.invoice.discountAmount,
    data.invoice.taxAmount,
    gratuity,
    packageCreditsTotal,
    depositAppliedTotal,
    totalPaid
  );

  const patientName = `${data.patient.firstName} ${data.patient.lastName}`;

  const refreshData = useCallback(async () => {
    try {
      const fresh = await getCheckoutDataAction(data.invoice.id);
      setData(fresh);
      const freshTotalPaid = fresh.payments
        .filter((p) => p.amount > 0)
        .reduce((sum, p) => sum + p.amount, 0);
      const freshTotal = fresh.invoice.total;
      if (freshTotalPaid >= freshTotal && freshTotal > 0) {
        setState("success");
      }
    } catch {
      // Non-critical
    }
  }, [data.invoice.id]);

  function handleGratuityChange(amount: number) {
    setGratuity(amount);
    startTransition(async () => {
      const result = await updateGratuityAction(data.invoice.id, amount);
      if (result.success) {
        setData((prev) => ({
          ...prev,
          invoice: {
            ...prev.invoice,
            gratuityAmount: result.gratuityAmount,
            total: result.total,
          },
        }));
      } else {
        setError(result.error);
      }
    });
  }

  function handlePackageToggle(itemId: string, match: PackageMatch) {
    if (redeemedItems.has(itemId)) return;
    startTransition(async () => {
      setError(null);
      const result = await redeemPackageForCheckoutAction(
        data.invoice.id,
        itemId,
        match.patientPackageId,
        match.serviceId
      );
      if (result.success) {
        setRedeemedItems((prev) => new Set([...prev, itemId]));
      } else {
        setError(result.error);
      }
    });
  }

  function handleApplyDeposit(depositId: string) {
    startTransition(async () => {
      setError(null);
      const result = await applyDepositAction(data.invoice.id, depositId);
      if (result.success) {
        setAppliedDepositIds((prev) => new Set([...prev, depositId]));
        await refreshData();
      } else {
        setError(result.error);
      }
    });
  }

  async function handlePaymentRecorded() {
    await refreshData();
  }

  function handlePaymentError(msg: string) {
    setError(msg);
  }

  if (state === "success") {
    return <CheckoutSuccess totalPaid={totals.total} onClose={onClose} />;
  }

  const avatarUrl = data.patient.avatarPhotoId
    ? `/api/photos/${data.patient.avatarPhotoId}`
    : undefined;

  const receiptTarget =
    receiptMethod === "email" ? data.patient.email : data.patient.phone;

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 space-y-6">
          {/* Patient hero */}
          <div className="flex items-center gap-3.5">
            <PatientAvatar
              size="lg"
              firstName={data.patient.firstName}
              lastName={data.patient.lastName}
              imageUrl={avatarUrl}
            />
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-gray-900 truncate">
                {patientName}
              </p>
              <p className="text-sm text-gray-400">
                Here&apos;s what {data.patient.firstName} owes today
              </p>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-3 text-red-900 font-medium hover:underline flex-shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Order summary card */}
          <OrderSummary
            items={data.items}
            totals={totals}
            redeemedItems={redeemedItems}
          />

          {/* Package credits */}
          {data.packageMatches.length > 0 && (
            <PackageCreditSection
              items={data.items}
              packageMatches={data.packageMatches}
              redeemedItems={redeemedItems}
              onToggle={handlePackageToggle}
              disabled={isPending}
            />
          )}

          {/* Gratuity */}
          <GratuitySelector
            preDiscountSubtotal={data.invoice.subtotal}
            discountAmount={data.invoice.discountAmount}
            value={gratuity}
            onChange={handleGratuityChange}
          />

          {/* Deposits */}
          {data.deposits.length > 0 && (
            <DepositSection
              deposits={data.deposits}
              appliedDepositIds={appliedDepositIds}
              onApply={handleApplyDeposit}
              applying={isPending}
            />
          )}

          {/* Split payment trail */}
          {data.payments.length > 0 && (
            <SplitPaymentTrail payments={data.payments} />
          )}

          {/* Payment zone — only when balance > 0 */}
          {totals.balanceDue > 0 && (
            <PaymentZone
              balanceDue={totals.balanceDue}
              savedCards={data.savedCards}
              walletBalance={data.walletBalance}
              stripeConnected={data.stripeConnected}
              stripeAccountId={data.stripeAccountId}
              invoiceId={data.invoice.id}
              patientName={patientName}
              onPaymentRecorded={handlePaymentRecorded}
              onError={handlePaymentError}
            />
          )}

          {/* Fully paid */}
          {totals.balanceDue <= 0 && totalPaid > 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-green-600 font-medium mb-3">
                Invoice is fully paid
              </p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-purple-600 px-8 py-3 text-sm font-semibold text-white hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200"
              >
                Done
              </button>
            </div>
          )}

          {/* Send receipt */}
          {(data.patient.email || data.patient.phone) && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Send receipt to
                </h3>
                <div className="flex items-center rounded-full bg-gray-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setReceiptMethod("email")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
                      receiptMethod === "email"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500"
                    }`}
                  >
                    Email
                  </button>
                  {data.patient.phone && (
                    <button
                      type="button"
                      onClick={() => setReceiptMethod("text")}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
                        receiptMethod === "text"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500"
                      }`}
                    >
                      Text
                    </button>
                  )}
                </div>
              </div>
              {receiptTarget && (
                <div className="flex items-center gap-2.5 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                  <span className="size-2 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-600">{receiptTarget}</span>
                </div>
              )}
            </div>
          )}

          {/* Footer text */}
          {receiptTarget && (
            <p className="text-center text-xs text-gray-400 pb-2">
              {data.patient.firstName} gets a receipt at {receiptTarget}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
