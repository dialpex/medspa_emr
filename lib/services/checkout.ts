import { prisma } from "@/lib/prisma";
import { decryptPatientData } from "@/lib/encryption/patient-encryption";
import { checkPackageAvailability, type PackageMatch } from "./packages";
import { getAppointmentDeposits } from "./stripe-deposits";
import { getWalletBalance } from "./wallet";

// Re-export shared types and functions for server-side consumers
export {
  calculateCheckoutTotals,
  type CheckoutLineItem,
  type CheckoutPatient,
  type CheckoutPayment,
  type SavedCard,
  type CheckoutDeposit,
  type CheckoutData,
  type CheckoutTotals,
} from "./checkout-shared";

import type { CheckoutPatient, CheckoutData } from "./checkout-shared";

// ── Data aggregation (server-only) ─────────────────────────

export async function buildCheckoutData(
  clinicId: string,
  invoiceId: string
): Promise<CheckoutData> {
  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { id: invoiceId, clinicId, deletedAt: null },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarPhotoId: true,
        },
      },
      items: {
        where: { deletedAt: null },
        select: {
          id: true,
          serviceId: true,
          productId: true,
          description: true,
          quantity: true,
          unitPrice: true,
          total: true,
        },
      },
      payments: {
        where: { deletedAt: null },
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          reference: true,
          createdAt: true,
          stripePaymentIntentId: true,
          stripeStatus: true,
          receiptUrl: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Decrypt patient data
  const decrypted = decryptPatientData(invoice.patient as Record<string, unknown>);
  const patient: CheckoutPatient = {
    id: invoice.patient.id,
    firstName: decrypted.firstName as string,
    lastName: decrypted.lastName as string,
    email: decrypted.email as string | null,
    phone: decrypted.phone as string | null,
    avatarPhotoId: (invoice.patient as Record<string, unknown>).avatarPhotoId as string | null,
  };

  // Clinic stripe info
  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: { stripeAccountId: true, stripeChargesEnabled: true },
  });
  const stripeConnected = !!(clinic.stripeAccountId && clinic.stripeChargesEnabled);

  // Fetch saved cards, wallet, packages, deposits in parallel
  const serviceIds = invoice.items
    .filter((i) => i.serviceId)
    .map((i) => i.serviceId!);

  const [savedCards, walletBalance, packageMatchArrays, deposits] = await Promise.all([
    stripeConnected
      ? prisma.stripePaymentMethod.findMany({
          where: { clinicId, patientId: patient.id, deletedAt: null },
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        })
      : Promise.resolve([]),
    getWalletBalance(clinicId, patient.id),
    Promise.all(
      serviceIds.map((sid) => checkPackageAvailability(clinicId, patient.id, sid))
    ),
    invoice.appointmentId
      ? getAppointmentDeposits(clinicId, invoice.appointmentId)
      : Promise.resolve([]),
  ]);

  // Flatten and deduplicate package matches
  const seenPackageService = new Set<string>();
  const packageMatches: PackageMatch[] = [];
  for (const matches of packageMatchArrays) {
    for (const m of matches) {
      const key = `${m.patientPackageId}:${m.serviceId}`;
      if (!seenPackageService.has(key)) {
        seenPackageService.add(key);
        packageMatches.push(m);
      }
    }
  }

  // Filter deposits to only succeeded, unapplied ones
  const applicableDeposits = deposits
    .filter((d) => d.paymentType === "deposit" && d.stripeStatus === "succeeded")
    .map((d) => ({
      id: d.id,
      amount: d.amount,
      createdAt: d.createdAt,
      stripeStatus: d.stripeStatus,
      paymentType: d.paymentType,
    }));

  return {
    invoice: {
      id: invoice.id,
      clinicId,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      subtotal: invoice.subtotal,
      discountAmount: invoice.discountAmount,
      discountPercent: invoice.discountPercent,
      taxAmount: invoice.taxAmount,
      taxRate: invoice.taxRate,
      total: invoice.total,
      gratuityAmount: invoice.gratuityAmount,
      appointmentId: invoice.appointmentId,
      notes: invoice.notes,
    },
    patient,
    items: invoice.items,
    payments: invoice.payments,
    savedCards: savedCards.map((c) => ({
      id: c.id,
      stripePaymentMethodId: c.stripePaymentMethodId,
      cardBrand: c.cardBrand,
      cardLast4: c.cardLast4,
      cardExpMonth: c.cardExpMonth,
      cardExpYear: c.cardExpYear,
      isDefault: c.isDefault,
    })),
    walletBalance,
    packageMatches,
    deposits: applicableDeposits,
    stripeConnected,
    stripeAccountId: clinic.stripeAccountId,
  };
}
