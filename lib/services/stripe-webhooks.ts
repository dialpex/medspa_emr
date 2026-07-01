import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { syncAccountStatusByStripeId } from "./stripe-connect";

export type WebhookResult = {
  revalidatePaths: string[];
};

export async function processWebhookEvent(event: Stripe.Event): Promise<WebhookResult> {
  const revalidatePaths: string[] = [];

  // Idempotency: check if we already processed this event
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
  });

  if (existing) return { revalidatePaths };

  // Record event first (idempotency key)
  await prisma.stripeWebhookEvent.create({
    data: {
      stripeEventId: event.id,
      eventType: event.type,
      payload: JSON.stringify(event.data.object),
    },
  });

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        revalidatePaths.push(...(await handlePaymentIntentSucceeded(event)));
        break;
      case "payment_intent.payment_failed":
        revalidatePaths.push(...(await handlePaymentIntentFailed(event)));
        break;
      case "payment_intent.canceled":
        revalidatePaths.push(...(await handlePaymentIntentCanceled(event)));
        break;
      case "charge.refunded":
        revalidatePaths.push(...(await handleChargeRefunded(event)));
        break;
      case "account.updated":
        await handleAccountUpdated(event);
        break;
      case "setup_intent.succeeded":
        revalidatePaths.push(...(await handleSetupIntentSucceeded(event)));
        break;
    }
  } catch (error) {
    await prisma.stripeWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }

  return { revalidatePaths };
}

async function handlePaymentIntentSucceeded(event: Stripe.Event): Promise<string[]> {
  const pi = event.data.object as Stripe.PaymentIntent;
  const neuvviaPaymentId = pi.metadata?.neuvviaPaymentId;
  if (!neuvviaPaymentId) return [];

  const charge = pi.latest_charge;
  let receiptUrl: string | undefined;
  let chargeId: string | undefined;

  if (typeof charge === "string") {
    chargeId = charge;
  } else if (charge && typeof charge === "object" && "id" in charge) {
    chargeId = charge.id;
    receiptUrl = (charge as Stripe.Charge).receipt_url ?? undefined;
  }

  await prisma.payment.update({
    where: { id: neuvviaPaymentId },
    data: {
      stripeStatus: "succeeded",
      stripeChargeId: chargeId ?? null,
      receiptUrl: receiptUrl ?? null,
    },
  });

  // Update invoice status
  const payment = await prisma.payment.findUnique({
    where: { id: neuvviaPaymentId },
    select: { invoiceId: true, clinicId: true },
  });

  if (payment) {
    if (payment.invoiceId) {
      await updateInvoicePaymentStatus(payment.invoiceId);
    }

    await createAuditLog({
      clinicId: payment.clinicId,
      action: "StripePaymentSucceeded",
      entityType: "Payment",
      entityId: neuvviaPaymentId,
      details: JSON.stringify({ paymentIntentId: pi.id, amount: pi.amount / 100 }),
    });
  }

  return ["/sales"];
}

async function handlePaymentIntentFailed(event: Stripe.Event): Promise<string[]> {
  const pi = event.data.object as Stripe.PaymentIntent;
  const neuvviaPaymentId = pi.metadata?.neuvviaPaymentId;
  if (!neuvviaPaymentId) return [];

  const failureMessage = pi.last_payment_error?.message ?? "Payment failed";

  await prisma.payment.update({
    where: { id: neuvviaPaymentId },
    data: {
      stripeStatus: "failed",
      failureReason: failureMessage,
    },
  });

  const payment = await prisma.payment.findUnique({
    where: { id: neuvviaPaymentId },
    select: { clinicId: true },
  });

  if (payment) {
    await createAuditLog({
      clinicId: payment.clinicId,
      action: "StripePaymentFailed",
      entityType: "Payment",
      entityId: neuvviaPaymentId,
      details: JSON.stringify({ paymentIntentId: pi.id, reason: failureMessage }),
    });
  }

  return ["/sales"];
}

async function handlePaymentIntentCanceled(event: Stripe.Event): Promise<string[]> {
  const pi = event.data.object as Stripe.PaymentIntent;
  const neuvviaPaymentId = pi.metadata?.neuvviaPaymentId;
  if (!neuvviaPaymentId) return [];

  await prisma.payment.update({
    where: { id: neuvviaPaymentId },
    data: { stripeStatus: "canceled" },
  });

  return ["/sales"];
}

async function handleChargeRefunded(event: Stripe.Event): Promise<string[]> {
  const charge = event.data.object as Stripe.Charge;
  const pi = charge.payment_intent;
  if (!pi) return [];

  const piId = typeof pi === "string" ? pi : pi.id;

  const payment = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: piId, deletedAt: null },
  });

  if (!payment) return [];

  const isFullRefund = charge.refunded;
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      stripeStatus: isFullRefund ? "refunded" : "partially_refunded",
    },
  });

  if (payment.invoiceId) {
    await updateInvoicePaymentStatus(payment.invoiceId);
  }
  return ["/sales"];
}

async function handleAccountUpdated(event: Stripe.Event): Promise<void> {
  const account = event.data.object as Stripe.Account;
  await syncAccountStatusByStripeId(account.id);
}

async function handleSetupIntentSucceeded(event: Stripe.Event): Promise<string[]> {
  const si = event.data.object as Stripe.SetupIntent;
  const clinicId = si.metadata?.clinicId;
  const patientId = si.metadata?.patientId;

  if (!clinicId || !patientId) return [];

  const pmId = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
  if (!pmId) return [];

  // Check if we already have this payment method
  const existing = await prisma.stripePaymentMethod.findUnique({
    where: { stripePaymentMethodId: pmId },
  });
  if (existing) return [];

  // Fetch payment method details from Stripe
  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: { stripeAccountId: true },
  });

  if (!clinic.stripeAccountId) return [];

  const { getStripe } = await import("@/lib/stripe/client");
  const stripe = getStripe();

  const pm = await stripe.paymentMethods.retrieve(pmId, {}, { stripeAccount: clinic.stripeAccountId });

  await prisma.stripePaymentMethod.create({
    data: {
      clinicId,
      patientId,
      stripePaymentMethodId: pmId,
      type: pm.type,
      cardBrand: pm.card?.brand ?? null,
      cardLast4: pm.card?.last4 ?? null,
      cardExpMonth: pm.card?.exp_month ?? null,
      cardExpYear: pm.card?.exp_year ?? null,
    },
  });

  return [`/patients/${patientId}`];
}

async function updateInvoicePaymentStatus(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      payments: {
        where: { deletedAt: null, stripeStatus: { not: "failed" } },
        select: { amount: true, stripeStatus: true },
      },
    },
  });

  // Only count succeeded payments and non-stripe payments
  const netPaid = invoice.payments
    .filter((p) => !p.stripeStatus || p.stripeStatus === "succeeded")
    .reduce((s, p) => s + p.amount, 0);

  let newStatus = invoice.status;
  if (netPaid >= invoice.total) {
    newStatus = "Paid";
  } else if (netPaid > 0) {
    newStatus = "PartiallyPaid";
  } else if (netPaid <= 0 && invoice.status === "Paid") {
    newStatus = "Refunded";
  }

  if (newStatus !== invoice.status) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: newStatus,
        paidAt: newStatus === "Paid" ? new Date() : newStatus === "Refunded" ? null : invoice.paidAt,
      },
    });
  }
}
