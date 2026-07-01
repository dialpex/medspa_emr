"use client";

import { useState, useEffect, useTransition } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  CreditCard,
  Banknote,
  Building2,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import {
  connectStripeAction,
  refreshOnboardingAction,
  getStripeStatusAction,
  getDepositSettingsAction,
  updateDepositSettingsAction,
  type DepositSettings,
} from "@/lib/actions/stripe";

type ConnectStatus = {
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeDetailsSubmitted: boolean;
  stripeDefaultCurrency: string | null;
};

type Props = {
  clinicName: string;
  initialStatus: ConnectStatus;
  canManage: boolean;
};

type AccountState = "not_started" | "in_progress" | "active" | "restricted";

function getAccountState(status: ConnectStatus): AccountState {
  if (!status.stripeAccountId) return "not_started";
  if (!status.stripeDetailsSubmitted) return "in_progress";
  if (status.stripeChargesEnabled && status.stripePayoutsEnabled) return "active";
  return "restricted";
}

export function BillingClient({ clinicName, initialStatus, canManage }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Deposit settings
  const [depositSettings, setDepositSettings] = useState<DepositSettings | null>(null);
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [depositPolicy, setDepositPolicy] = useState<string>("refundable");
  const [depositSaving, setDepositSaving] = useState(false);
  const [depositMsg, setDepositMsg] = useState<string | null>(null);

  const accountState = getAccountState(status);

  // Load deposit settings when active
  useEffect(() => {
    if (accountState === "active") {
      getDepositSettingsAction().then((result) => {
        if (result.success) {
          setDepositSettings(result.data);
          setDepositEnabled(result.data.depositEnabled);
          setDepositAmount(result.data.defaultDepositAmount?.toString() ?? "");
          setDepositPolicy(result.data.depositPolicy ?? "refundable");
        }
      });
    }
  }, [accountState]);

  function handleGetStarted() {
    setError(null);
    startTransition(async () => {
      const result = await connectStripeAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      window.location.href = result.data.url;
    });
  }

  function handleContinueSetup() {
    setError(null);
    startTransition(async () => {
      const result = await refreshOnboardingAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      window.location.href = result.data.url;
    });
  }

  function handleRefreshStatus() {
    setError(null);
    startTransition(async () => {
      const result = await getStripeStatusAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setStatus(result.data);
    });
  }

  async function handleSaveDeposits() {
    setDepositSaving(true);
    setDepositMsg(null);
    const result = await updateDepositSettingsAction({
      depositEnabled,
      defaultDepositAmount: depositAmount ? parseFloat(depositAmount) : null,
      depositPolicy: depositEnabled ? depositPolicy : null,
    });
    if (result.success) {
      setDepositMsg("Deposit settings saved.");
    } else {
      setDepositMsg(result.error);
    }
    setDepositSaving(false);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ========== NOT STARTED ========== */}
      {accountState === "not_started" && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          {/* Hero section */}
          <div className="bg-gradient-to-br from-purple-50 to-white px-8 py-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <CreditCard className="size-5 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Merchant Account</h3>
            </div>
            <p className="text-sm text-gray-600 max-w-md mb-6">
              Set up your merchant account to accept card payments directly through Neuvvia. Funds are deposited to your bank account within 2 business days.
            </p>

            {/* What you'll need */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="flex items-start gap-3">
                <Building2 className="size-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Business details</div>
                  <div className="text-xs text-gray-500">Legal name, address, tax ID</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="size-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Identity verification</div>
                  <div className="text-xs text-gray-500">Government-issued ID</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Banknote className="size-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Bank account</div>
                  <div className="text-xs text-gray-500">Checking account for payouts</div>
                </div>
              </div>
            </div>

            {canManage ? (
              <button
                onClick={handleGetStarted}
                disabled={isPending}
                className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
                Get Started
              </button>
            ) : (
              <p className="text-sm text-gray-400">
                Contact your clinic owner or admin to set up the merchant account.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ========== IN PROGRESS ========== */}
      {accountState === "in_progress" && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-8 py-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                  <CreditCard className="size-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Merchant Account</h3>
                  <p className="text-sm text-gray-500">{clinicName}</p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                Setup Incomplete
              </span>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Your merchant account setup is not yet complete. You&apos;ll need to finish submitting your business details, identity verification, and bank account information to start accepting payments.
            </p>

            {/* Checklist */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                <span className="text-gray-700">Account created</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <AlertCircle className="size-4 text-yellow-500 shrink-0" />
                <span className="text-gray-700">Business details &amp; verification pending</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="size-4 rounded-full border-2 border-gray-300 shrink-0" />
                <span className="text-gray-400">Charges &amp; payouts</span>
              </div>
            </div>

            <div className="flex gap-3">
              {canManage && (
                <button
                  onClick={handleContinueSetup}
                  disabled={isPending}
                  className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  Continue Setup
                </button>
              )}
              <button
                onClick={handleRefreshStatus}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {isPending ? "Checking..." : "Check Status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== ACTIVE ========== */}
      {accountState === "active" && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-8 py-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                  <CreditCard className="size-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Merchant Account</h3>
                  <p className="text-sm text-gray-500">{clinicName}</p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                Active
              </span>
            </div>

            {/* Account details */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6">
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Charges</div>
                <div className="flex items-center gap-1.5 text-sm text-green-700">
                  <CheckCircle2 className="size-3.5" />
                  Enabled
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Payouts</div>
                <div className="flex items-center gap-1.5 text-sm text-green-700">
                  <CheckCircle2 className="size-3.5" />
                  Enabled
                </div>
              </div>
              {status.stripeDefaultCurrency && (
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Currency</div>
                  <div className="text-sm text-gray-900">{status.stripeDefaultCurrency.toUpperCase()}</div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={handleRefreshStatus}
                disabled={isPending}
                className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                {isPending ? "Checking..." : "Refresh status"}
              </button>
              <div className="text-xs text-gray-400">Powered by Stripe</div>
            </div>
          </div>
        </div>
      )}

      {/* ========== RESTRICTED ========== */}
      {accountState === "restricted" && (
        <div className="rounded-xl border border-red-200 overflow-hidden">
          <div className="px-8 py-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                  <AlertCircle className="size-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Merchant Account</h3>
                  <p className="text-sm text-gray-500">{clinicName}</p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                Restricted
              </span>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Your merchant account has restrictions that may prevent some payment features from working. Please review and update your account information to resolve this.
            </p>

            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2 text-sm">
                {status.stripeChargesEnabled ? (
                  <CheckCircle2 className="size-4 text-green-500" />
                ) : (
                  <AlertCircle className="size-4 text-red-500" />
                )}
                <span>Charges {status.stripeChargesEnabled ? "enabled" : "disabled"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {status.stripePayoutsEnabled ? (
                  <CheckCircle2 className="size-4 text-green-500" />
                ) : (
                  <AlertCircle className="size-4 text-red-500" />
                )}
                <span>Payouts {status.stripePayoutsEnabled ? "enabled" : "disabled"}</span>
              </div>
            </div>

            <div className="flex gap-3">
              {canManage && (
                <button
                  onClick={handleContinueSetup}
                  disabled={isPending}
                  className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  Update Account
                </button>
              )}
              <button
                onClick={handleRefreshStatus}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {isPending ? "Checking..." : "Check Status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== DEPOSIT SETTINGS (active only) ========== */}
      {accountState === "active" && canManage && depositSettings !== null && (
        <div className="rounded-xl border border-gray-200 p-8">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Deposits</h3>
          <p className="text-sm text-gray-500 mb-5">
            Collect deposits when booking appointments. Deposits can be applied to invoices at checkout.
          </p>

          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={depositEnabled}
                onChange={(e) => setDepositEnabled(e.target.checked)}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">Enable appointment deposits</span>
            </label>

            {depositEnabled && (
              <div className="pl-8 space-y-4 border-l-2 border-purple-100 ml-1.5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default amount</label>
                  <div className="relative w-40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="50.00"
                      className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation policy</label>
                  <select
                    value={depositPolicy}
                    onChange={(e) => setDepositPolicy(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="refundable">Fully refundable</option>
                    <option value="non_refundable">Non-refundable</option>
                    <option value="partial_refund">Partial refund</option>
                  </select>
                </div>
              </div>
            )}

            {depositMsg && (
              <div className={`rounded-lg px-4 py-2 text-sm ${depositMsg.includes("saved") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {depositMsg}
              </div>
            )}

            <button
              onClick={handleSaveDeposits}
              disabled={depositSaving}
              className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {depositSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
