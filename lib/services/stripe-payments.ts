import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe/client";
import { getPlatformFeePercent } from "@/lib/stripe/constants";
import { getOrCreateStripeCustomer } from "./stripe-connect";
import crypto from "crypto";

export async function createPaymentIntent(
  clinicId: string,
  invoiceId: string,
  patientId: string,
  amount?: number
): Promise<{ clientSecret: string; paymentId: string }> {
  const stripe = getStripe();

  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: { stripeAccountId: true, stripeChargesEnabled: true, platformFeePercent: true },
  });

  if (!clinic.stripeAccountId || !clinic.stripeChargesEnabled) {
    throw new Error("Card payments are not active for this clinic");
  }

  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { id: invoiceId, clinicId, deletedAt: null },
    include: { payments: { where: { deletedAt: null }, select: { amount: true } } },
  });

  const totalPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const maxAmount = Math.round((invoice.total - totalPaid) * 100) / 100;

  if (maxAmount <= 0) {
    throw new Error("Invoice is already fully paid");
  }

  const chargeAmount = amount ? Math.min(amount, maxAmount) : maxAmount;
  const chargeAmountCents = Math.round(chargeAmount * 100);

  const customerId = await getOrCreateStripeCustomer(clinicId, patientId);

  const feePercent = getPlatformFeePercent(clinic.platformFeePercent);
  const applicationFeeAmount = feePercent > 0 ? Math.round(chargeAmountCents * feePercent / 100) : undefined;

  const paymentId = crypto.randomUUID();

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: chargeAmountCents,
      currency: "usd",
      customer: customerId,
      metadata: {
        clinicId,
        invoiceId,
        neuvviaPaymentId: paymentId,
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
      invoiceId,
      amount: chargeAmount,
      paymentMethod: "Stripe",
      stripeStatus: "pending",
      stripePaymentIntentId: paymentIntent.id,
    },
  });

  return { clientSecret: paymentIntent.client_secret!, paymentId };
}

export async function chargeWithSavedMethod(
  clinicId: string,
  invoiceId: string,
  patientId: string,
  paymentMethodId: string,
  amount?: number
): Promise<{ status: string; clientSecret?: string }> {
  const stripe = getStripe();

  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: { stripeAccountId: true, stripeChargesEnabled: true, platformFeePercent: true },
  });

  if (!clinic.stripeAccountId || !clinic.stripeChargesEnabled) {
    throw new Error("Card payments are not active for this clinic");
  }

  const savedMethod = await prisma.stripePaymentMethod.findFirst({
    where: { id: paymentMethodId, clinicId, patientId, deletedAt: null },
  });

  if (!savedMethod) {
    throw new Error("Payment method not found");
  }

  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { id: invoiceId, clinicId, deletedAt: null },
    include: { payments: { where: { deletedAt: null }, select: { amount: true } } },
  });

  const totalPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const maxAmount = Math.round((invoice.total - totalPaid) * 100) / 100;

  if (maxAmount <= 0) {
    throw new Error("Invoice is already fully paid");
  }

  const chargeAmount = amount ? Math.min(amount, maxAmount) : maxAmount;
  const chargeAmountCents = Math.round(chargeAmount * 100);

  const customerId = await getOrCreateStripeCustomer(clinicId, patientId);

  const feePercent = getPlatformFeePercent(clinic.platformFeePercent);
  const applicationFeeAmount = feePercent > 0 ? Math.round(chargeAmountCents * feePercent / 100) : undefined;

  const paymentId = crypto.randomUUID();

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: chargeAmountCents,
      currency: "usd",
      customer: customerId,
      payment_method: savedMethod.stripePaymentMethodId,
      confirm: true,
      return_url: `${process.env.APP_URL || "http://localhost:3000"}/sales`,
      metadata: {
        clinicId,
        invoiceId,
        neuvviaPaymentId: paymentId,
      },
      ...(applicationFeeAmount ? { application_fee_amount: applicationFeeAmount } : {}),
    },
    { stripeAccount: clinic.stripeAccountId }
  );

  await prisma.payment.create({
    data: {
      id: paymentId,
      clinicId,
      invoiceId,
      amount: chargeAmount,
      paymentMethod: "Stripe",
      stripeStatus: paymentIntent.status,
      stripePaymentIntentId: paymentIntent.id,
    },
  });

  if (paymentIntent.status === "requires_action") {
    return { status: "requires_action", clientSecret: paymentIntent.client_secret! };
  }

  return { status: paymentIntent.status };
}

export async function processRefund(
  clinicId: string,
  paymentId: string,
  amount?: number
): Promise<{ refundId: string }> {
  const stripe = getStripe();

  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: { stripeAccountId: true },
  });

  if (!clinic.stripeAccountId) {
    throw new Error("Card payments are not active for this clinic");
  }

  const payment = await prisma.payment.findFirstOrThrow({
    where: { id: paymentId, clinicId, deletedAt: null, stripePaymentIntentId: { not: null } },
  });

  const refundAmountCents = amount ? Math.round(amount * 100) : undefined;

  const refund = await stripe.refunds.create(
    {
      payment_intent: payment.stripePaymentIntentId!,
      ...(refundAmountCents ? { amount: refundAmountCents } : {}),
      metadata: {
        clinicId,
        originalPaymentId: paymentId,
      },
    },
    { stripeAccount: clinic.stripeAccountId }
  );

  const refundAmount = refund.amount / 100;

  const refundPayment = await prisma.payment.create({
    data: {
      clinicId,
      invoiceId: payment.invoiceId ?? undefined,
      amount: -refundAmount,
      paymentMethod: "Stripe Refund",
      stripeRefundId: refund.id,
      stripeStatus: refund.status ?? "pending",
      reference: `Refund for payment ${paymentId}`,
    },
  });

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      stripeStatus: refundAmountCents && refundAmountCents < Math.round(payment.amount * 100)
        ? "partially_refunded"
        : "refunded",
    },
  });

  // Update invoice status (only if payment was tied to an invoice)
  if (payment.invoiceId) {
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: payment.invoiceId },
      include: { payments: { where: { deletedAt: null }, select: { amount: true } } },
    });

    const netPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
    let newStatus = invoice.status;
    if (netPaid <= 0) {
      newStatus = "Refunded";
    } else if (netPaid < invoice.total) {
      newStatus = "PartiallyPaid";
    }

    if (newStatus !== invoice.status) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: newStatus, paidAt: newStatus === "Refunded" ? null : invoice.paidAt },
      });
    }
  }

  return { refundId: refundPayment.id };
}

export async function getPatientPaymentMethods(clinicId: string, patientId: string) {
  return prisma.stripePaymentMethod.findMany({
    where: { clinicId, patientId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function removePaymentMethod(clinicId: string, paymentMethodId: string): Promise<void> {
  const stripe = getStripe();

  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: { stripeAccountId: true },
  });

  const method = await prisma.stripePaymentMethod.findFirstOrThrow({
    where: { id: paymentMethodId, clinicId, deletedAt: null },
  });

  if (clinic.stripeAccountId) {
    try {
      await stripe.paymentMethods.detach(
        method.stripePaymentMethodId,
        {},
        { stripeAccount: clinic.stripeAccountId }
      );
    } catch {
      // Method may already be detached on Stripe side
    }
  }

  await prisma.stripePaymentMethod.update({
    where: { id: paymentMethodId },
    data: { deletedAt: new Date() },
  });
}
