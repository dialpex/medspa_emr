"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Banknote,
  CreditCard,
  Wallet,
  FileText,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SavedCardSelector } from "./saved-card-selector";
import { CashTendered } from "./cash-tendered";
import { StripeProvider } from "@/components/stripe/stripe-provider";
import { CheckoutForm } from "@/components/stripe/checkout-form";
import type { SavedCard } from "@/lib/services/checkout-shared";

type PaymentMethod = "cash" | "card" | "wallet" | "check" | "other";

type Props = {
  balanceDue: number;
  savedCards: SavedCard[];
  walletBalance: number;
  stripeConnected: boolean;
  stripeAccountId: string | null;
  invoiceId: string;
  patientName: string;
  onPaymentRecorded: () => void;
  onError: (msg: string) => void;
};

type MethodConfig = {
  id: PaymentMethod;
  label: string;
  icon: typeof CreditCard;
  badge?: (p: Props) => string | null;
  showWhen?: (p: Props) => boolean;
};

const METHODS: MethodConfig[] = [
  { id: "cash", label: "CASH", icon: Banknote },
  {
    id: "card",
    label: "CARD",
    icon: CreditCard,
    showWhen: (p) => p.stripeConnected,
  },
  {
    id: "wallet",
    label: "WALLET",
    icon: Wallet,
    badge: (p) => `$${p.walletBalance.toFixed(2)}`,
  },
  { id: "check", label: "CHECK", icon: FileText },
  { id: "other", label: "OTHER", icon: MoreHorizontal },
];

export function PaymentZone(props: Props) {
  const {
    balanceDue,
    savedCards,
    walletBalance,
    stripeConnected,
    stripeAccountId,
    invoiceId,
    patientName,
    onPaymentRecorded,
    onError,
  } = props;

  const [activeMethod, setActiveMethod] = useState<PaymentMethod>("cash");
  const [payAmount, setPayAmount] = useState(balanceDue);
  const [selectedCardId, setSelectedCardId] = useState<string | "new">(
    savedCards.length > 0 ? savedCards[0].id : "new"
  );
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [reference, setReference] = useState("");

  // Indicator positioning
  const pillsRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const hasAnimated = useRef(false);

  const visibleMethods = METHODS.filter((m) => !m.showWhen || m.showWhen(props));

  // Content height animation
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | "auto">("auto");

  const updateIndicator = useCallback(() => {
    if (!pillsRef.current) return;
    const activeEl = pillsRef.current.querySelector(
      `[data-method="${activeMethod}"]`
    ) as HTMLElement | null;
    if (activeEl) {
      const containerRect = pillsRef.current.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();
      setIndicator({
        left: elRect.left - containerRect.left,
        width: elRect.width,
      });
    }
  }, [activeMethod]);

  useEffect(() => {
    // Delay first animation frame to avoid mount flicker
    if (!hasAnimated.current) {
      requestAnimationFrame(() => {
        updateIndicator();
        hasAnimated.current = true;
      });
    } else {
      updateIndicator();
    }
  }, [updateIndicator]);

  // Measure content height for animation
  useEffect(() => {
    if (!contentRef.current) return;
    const el = contentRef.current;
    // Temporarily set auto to measure
    el.style.height = "auto";
    const h = el.scrollHeight;
    el.style.height = "";
    setContentHeight(h);
  }, [activeMethod, stripeClientSecret]);

  async function handleStripeNewCard() {
    if (payAmount <= 0) return;
    setIsProcessing(true);
    try {
      const res = await fetch("/api/billing/stripe/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, amount: payAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment");
      setStripeClientSecret(data.clientSecret);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to initialize payment");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleStripeSavedCard() {
    if (payAmount <= 0 || selectedCardId === "new") return;
    setIsProcessing(true);
    try {
      const res = await fetch("/api/billing/stripe/charge-saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          paymentMethodId: selectedCardId,
          amount: payAmount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to charge card");
      if (data.status === "requires_action" && data.clientSecret) {
        setStripeClientSecret(data.clientSecret);
      } else {
        onPaymentRecorded();
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to charge card");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleNonStripePayment(method: string, amount: number) {
    setIsProcessing(true);
    try {
      if (method === "Wallet") {
        const { payWithWallet } = await import("@/lib/actions/wallet");
        const result = await payWithWallet(invoiceId, amount);
        if (!result.success) throw new Error(result.error);
      } else {
        const { recordPayment } = await import("@/lib/actions/invoices");
        const result = await recordPayment({
          invoiceId,
          amount,
          paymentMethod: method,
          reference: reference || undefined,
        });
        if (!result.success) throw new Error(result.error);
      }
      onPaymentRecorded();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleCTA() {
    switch (activeMethod) {
      case "card":
        if (selectedCardId === "new") handleStripeNewCard();
        else handleStripeSavedCard();
        break;
      case "cash":
        handleNonStripePayment("Cash", balanceDue);
        break;
      case "wallet":
        handleNonStripePayment("Wallet", payAmount);
        break;
      case "check":
        handleNonStripePayment("Check", payAmount);
        break;
      case "other":
        handleNonStripePayment("Other", payAmount);
        break;
    }
  }

  const ctaLabel = (() => {
    if (isProcessing) return "Processing...";
    const amount = `$${balanceDue.toFixed(2)}`;
    switch (activeMethod) {
      case "card":
        return selectedCardId === "new"
          ? `Enter Card Details \u2014 ${amount}`
          : `Charge ${amount}`;
      case "cash":
        return `Record ${amount} payment`;
      case "wallet":
        return `Pay ${amount} from Wallet`;
      default:
        return `Record ${amount} payment`;
    }
  })();

  return (
    <div className="space-y-5">
      {/* Section label */}
      <h3 className="text-sm font-semibold text-gray-900">
        How would {patientName.split(" ")[0]} like to pay?
      </h3>

      {/* Method cards with sliding indicator */}
      <div
        ref={pillsRef}
        className="relative flex items-stretch gap-0 rounded-xl bg-gray-100 p-1"
      >
        {/* Sliding indicator */}
        <div
          className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm border border-gray-200 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            left: indicator.left,
            width: indicator.width,
            ...(hasAnimated.current ? {} : { transition: "none" }),
          }}
        />

        {visibleMethods.map((m) => {
          const Icon = m.icon;
          const badge = m.badge?.(props);
          const isActive = activeMethod === m.id;
          return (
            <button
              key={m.id}
              type="button"
              data-method={m.id}
              onClick={() => {
                setActiveMethod(m.id);
                setStripeClientSecret(null);
                setPayAmount(balanceDue);
              }}
              className={cn(
                "relative z-10 flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-lg transition-colors duration-200",
                isActive ? "text-purple-700" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Icon className="size-5" strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-bold tracking-wider leading-none">
                {m.label}
              </span>
              {badge && (
                <span className="text-[9px] font-medium opacity-70 leading-none">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Animated content area */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ height: contentHeight === "auto" ? "auto" : contentHeight }}
      >
        {/* Cash */}
        {activeMethod === "cash" && (
          <CashTendered
            balanceDue={balanceDue}
            onRecord={(amount) => handleNonStripePayment("Cash", amount)}
            isPending={isProcessing}
          />
        )}

        {/* Card — pre-Stripe Elements */}
        {activeMethod === "card" && !stripeClientSecret && (
          <div className="space-y-3">
            {savedCards.length > 0 && (
              <SavedCardSelector
                cards={savedCards}
                selectedId={selectedCardId}
                onSelect={setSelectedCardId}
              />
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Amount
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  max={balanceDue}
                  value={payAmount}
                  onChange={(e) =>
                    setPayAmount(parseFloat(e.target.value) || 0)
                  }
                  className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                />
                {payAmount !== balanceDue && (
                  <button
                    type="button"
                    onClick={() => setPayAmount(balanceDue)}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium whitespace-nowrap"
                  >
                    Pay in Full
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Card — Stripe Elements inline */}
        {activeMethod === "card" && stripeClientSecret && stripeAccountId && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <StripeProvider
              clientSecret={stripeClientSecret}
              stripeAccountId={stripeAccountId}
            >
              <CheckoutForm
                onSuccess={onPaymentRecorded}
                onError={onError}
                amount={payAmount}
              />
            </StripeProvider>
          </div>
        )}

        {/* Wallet */}
        {activeMethod === "wallet" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-purple-50 border border-purple-100 px-4 py-3">
              <span className="text-sm text-purple-700">Wallet Balance</span>
              <span className="text-sm font-semibold text-purple-700 tabular-nums">
                ${walletBalance.toFixed(2)}
              </span>
            </div>
            {walletBalance <= 0 && (
              <p className="text-sm text-gray-400">
                No wallet balance available.
              </p>
            )}
            {walletBalance > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Amount
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    max={Math.min(walletBalance, balanceDue)}
                    value={payAmount}
                    onChange={(e) =>
                      setPayAmount(parseFloat(e.target.value) || 0)
                    }
                    className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPayAmount(Math.min(walletBalance, balanceDue))
                    }
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium whitespace-nowrap"
                  >
                    Max
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Check / Other */}
        {(activeMethod === "check" || activeMethod === "other") && (
          <div className="space-y-3">
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  max={balanceDue}
                  value={payAmount}
                  onChange={(e) =>
                    setPayAmount(parseFloat(e.target.value) || 0)
                  }
                  className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">
                  Reference
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CTA — always visible unless Stripe Elements is showing its own button */}
      {!(activeMethod === "card" && stripeClientSecret) && (
        <button
          type="button"
          onClick={handleCTA}
          disabled={
            isProcessing ||
            balanceDue <= 0 ||
            (activeMethod === "wallet" && (walletBalance <= 0 || payAmount <= 0 || payAmount > walletBalance))
          }
          className="w-full rounded-full bg-purple-600 px-6 py-4 text-base font-bold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-lg shadow-purple-200 flex items-center justify-center gap-2"
        >
          {isProcessing && <Loader2 className="size-4 animate-spin" />}
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
