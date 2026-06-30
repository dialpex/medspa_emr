export const STRIPE_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "account.updated",
  "setup_intent.succeeded",
] as const;

export type StripeEventType = (typeof STRIPE_EVENTS)[number];

export function getPlatformFeePercent(clinicOverride?: number | null): number {
  if (clinicOverride != null) return clinicOverride;
  return parseFloat(process.env.PLATFORM_FEE_PERCENT || "0");
}

export function getAppUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}
