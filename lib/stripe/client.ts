import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function isPaymentProcessingConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("Payment processing is not configured. Contact your platform administrator.");
    }
    stripeInstance = new Stripe(key, {
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
    });
  }
  return stripeInstance;
}
