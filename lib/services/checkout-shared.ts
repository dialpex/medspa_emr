// Shared types and pure functions for checkout
// Safe to import from both client and server components

import type { PackageMatch } from "./packages";

// ── Types ──────────────────────────────────────────────────

export type CheckoutLineItem = {
  id: string;
  serviceId: string | null;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type CheckoutPatient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  avatarPhotoId: string | null;
};

export type CheckoutPayment = {
  id: string;
  amount: number;
  paymentMethod: string;
  reference: string | null;
  createdAt: Date;
  stripePaymentIntentId: string | null;
  stripeStatus: string | null;
  receiptUrl: string | null;
};

export type SavedCard = {
  id: string;
  stripePaymentMethodId: string;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  isDefault: boolean;
};

export type CheckoutDeposit = {
  id: string;
  amount: number;
  createdAt: Date;
  stripeStatus: string | null;
  paymentType: string;
};

export type CheckoutData = {
  invoice: {
    id: string;
    clinicId: string;
    invoiceNumber: string;
    status: string;
    subtotal: number;
    discountAmount: number;
    discountPercent: number | null;
    taxAmount: number;
    taxRate: number | null;
    total: number;
    gratuityAmount: number;
    appointmentId: string | null;
    notes: string | null;
  };
  patient: CheckoutPatient;
  items: CheckoutLineItem[];
  payments: CheckoutPayment[];
  savedCards: SavedCard[];
  walletBalance: number;
  packageMatches: PackageMatch[];
  deposits: CheckoutDeposit[];
  stripeConnected: boolean;
  stripeAccountId: string | null;
};

export type CheckoutTotals = {
  subtotal: number;
  discount: number;
  tax: number;
  gratuity: number;
  packageCredits: number;
  depositApplied: number;
  total: number;
  totalPaid: number;
  balanceDue: number;
};

// ── Pure calculation ───────────────────────────────────────

export function calculateCheckoutTotals(
  subtotal: number,
  discount: number,
  tax: number,
  gratuity: number,
  packageCredits: number,
  depositApplied: number,
  totalPaid: number
): CheckoutTotals {
  const total = Math.round((subtotal - discount + tax + gratuity) * 100) / 100;
  const balanceDue = Math.round((total - packageCredits - depositApplied - totalPaid) * 100) / 100;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    gratuity: Math.round(gratuity * 100) / 100,
    packageCredits: Math.round(packageCredits * 100) / 100,
    depositApplied: Math.round(depositApplied * 100) / 100,
    total: Math.max(0, total),
    totalPaid: Math.round(totalPaid * 100) / 100,
    balanceDue: Math.max(0, balanceDue),
  };
}
