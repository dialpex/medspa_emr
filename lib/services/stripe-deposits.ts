import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe/client";
import { getPlatformFeePercent } from "@/lib/stripe/constants";
import { getOrCreateStripeCustomer } from "./stripe-connect";
import { createAuditLog } from "@/lib/audit";
import crypto from "crypto";

export async function collectDeposit(
  clinicId: string,
  patientId: string,
  appointmentId: string,
  amount: number
): Promise<{ clientSecret: string; paymentId: string }> {
  const stripe = getStripe();

  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: { stripeAccountId: true, stripeChargesEnabled: true, platformFeePercent: true },
  });

  if (!clinic.stripeAccountId || !clinic.stripeChargesEnabled) {
    throw new Error("Card payments are not active for this clinic");
  }

  // Verify appointment belongs to clinic and patient
  await prisma.appointment.findFirstOrThrow({
    where: { id: appointmentId, clinicId, patientId, deletedAt: null },
  });

  if (amount <= 0) {
    throw new Error("Deposit amount must be positive");
  }

  const amountCents = Math.round(amount * 100);
  const customerId = await getOrCreateStripeCustomer(clinicId, patientId);

  const feePercent = getPlatformFeePercent(clinic.platformFeePercent);
  const applicationFeeAmount = feePercent > 0 ? Math.round(amountCents * feePercent / 100) : undefined;

  const paymentId = crypto.randomUUID();

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: "usd",
      customer: customerId,
      metadata: {
        clinicId,
        appointmentId,
        neuvviaPaymentId: paymentId,
        paymentType: "deposit",
      },
      automatic_payment_methods: { enabled: true },
      ...(applicationFeeAmount ? { application_fee_amount: applicationFeeAmount } : {}),
    },
    { stripeAccount: clinic.stripeAccountId }
  );

  await prisma.payment.create({
    data: {
      id: paymentId,
      clinicId,
      appointmentId,
      amount,
      paymentMethod: "Stripe",
      paymentType: "deposit",
      stripeStatus: "pending",
      stripePaymentIntentId: paymentIntent.id,
    },
  });

  await createAuditLog({
    clinicId,
    action: "StripeDepositCreate",
    entityType: "Payment",
    entityId: paymentId,
    details: JSON.stringify({ appointmentId, amount }),
  });

  return { clientSecret: paymentIntent.client_secret!, paymentId };
}

export async function applyDepositToInvoice(
  clinicId: string,
  depositPaymentId: string,
  invoiceId: string
): Promise<void> {
  const deposit = await prisma.payment.findFirstOrThrow({
    where: {
      id: depositPaymentId,
      clinicId,
      paymentType: "deposit",
      stripeStatus: "succeeded",
      deletedAt: null,
    },
  });

  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { id: invoiceId, clinicId, deletedAt: null },
    include: { payments: { where: { deletedAt: null }, select: { amount: true } } },
  });

  const totalPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.round((invoice.total - totalPaid) * 100) / 100;
  const applyAmount = Math.min(deposit.amount, balance);

  if (applyAmount <= 0) {
    throw new Error("No balance remaining on invoice");
  }

  await prisma.$transaction([
    // Mark deposit as applied
    prisma.payment.update({
      where: { id: depositPaymentId },
      data: { paymentType: "deposit_application", invoiceId },
    }),
    // Create offsetting credit on the invoice
    prisma.payment.create({
      data: {
        clinicId,
        invoiceId,
        amount: applyAmount,
        paymentMethod: "Deposit Applied",
        paymentType: "deposit_application",
        reference: `Applied from deposit ${depositPaymentId}`,
      },
    }),
  ]);

  await createAuditLog({
    clinicId,
    action: "StripeDepositApply",
    entityType: "Payment",
    entityId: depositPaymentId,
    details: JSON.stringify({ invoiceId, amount: applyAmount }),
  });
}

export async function refundDeposit(
  clinicId: string,
  depositPaymentId: string
): Promise<{ refundId: string }> {
  const stripe = getStripe();

  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: { stripeAccountId: true },
  });

  if (!clinic.stripeAccountId) {
    throw new Error("Card payments are not active for this clinic");
  }

  const deposit = await prisma.payment.findFirstOrThrow({
    where: {
      id: depositPaymentId,
      clinicId,
      paymentType: "deposit",
      stripePaymentIntentId: { not: null },
      deletedAt: null,
    },
  });

  const refund = await stripe.refunds.create(
    {
      payment_intent: deposit.stripePaymentIntentId!,
      metadata: { clinicId, originalPaymentId: depositPaymentId },
    },
    { stripeAccount: clinic.stripeAccountId }
  );

  const refundAmount = refund.amount / 100;

  const refundPayment = await prisma.payment.create({
    data: {
      clinicId,
      appointmentId: deposit.appointmentId,
      amount: -refundAmount,
      paymentMethod: "Stripe Refund",
      paymentType: "deposit",
      stripeRefundId: refund.id,
      stripeStatus: refund.status ?? "pending",
      reference: `Refund for deposit ${depositPaymentId}`,
    },
  });

  await prisma.payment.update({
    where: { id: depositPaymentId },
    data: { stripeStatus: "refunded" },
  });

  await createAuditLog({
    clinicId,
    action: "StripeDepositRefund",
    entityType: "Payment",
    entityId: depositPaymentId,
    details: JSON.stringify({ refundId: refundPayment.id, amount: refundAmount }),
  });

  return { refundId: refundPayment.id };
}

export async function forfeitDeposit(
  clinicId: string,
  depositPaymentId: string
): Promise<void> {
  await prisma.payment.findFirstOrThrow({
    where: {
      id: depositPaymentId,
      clinicId,
      paymentType: "deposit",
      deletedAt: null,
    },
  });

  await prisma.payment.update({
    where: { id: depositPaymentId },
    data: { stripeStatus: "forfeited", notes: "No-show deposit forfeited" },
  });

  await createAuditLog({
    clinicId,
    action: "StripeDepositForfeit",
    entityType: "Payment",
    entityId: depositPaymentId,
  });
}

export async function getAppointmentDeposits(clinicId: string, appointmentId: string) {
  return prisma.payment.findMany({
    where: {
      clinicId,
      appointmentId,
      paymentType: { in: ["deposit", "deposit_application"] },
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
}
