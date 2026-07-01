import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe/client";
import { getAppUrl } from "@/lib/stripe/constants";
import { decryptPatientData } from "@/lib/encryption/patient-encryption";

export type ConnectStatus = {
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeDetailsSubmitted: boolean;
  stripeDefaultCurrency: string | null;
};

export async function getConnectStatus(clinicId: string): Promise<ConnectStatus> {
  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: {
      stripeAccountId: true,
      stripeOnboardingComplete: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeDetailsSubmitted: true,
      stripeDefaultCurrency: true,
    },
  });
  return clinic;
}

export async function createConnectAccount(clinicId: string, email: string): Promise<string> {
  const stripe = getStripe();

  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: { stripeAccountId: true, name: true },
  });

  if (clinic.stripeAccountId) {
    return clinic.stripeAccountId;
  }

  const account = await stripe.accounts.create({
    type: "standard",
    email,
    business_profile: {
      name: clinic.name,
    },
    metadata: {
      clinicId,
    },
  });

  await prisma.clinic.update({
    where: { id: clinicId },
    data: { stripeAccountId: account.id },
  });

  return account.id;
}

export async function createAccountLink(stripeAccountId: string, clinicId: string): Promise<string> {
  const stripe = getStripe();
  const appUrl = getAppUrl();

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${appUrl}/api/billing/stripe/connect/return?clinicId=${clinicId}`,
    return_url: `${appUrl}/api/billing/stripe/connect/return?clinicId=${clinicId}`,
    type: "account_onboarding",
  });

  return accountLink.url;
}

export async function syncAccountStatus(clinicId: string): Promise<ConnectStatus> {
  const stripe = getStripe();

  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: { stripeAccountId: true },
  });

  if (!clinic.stripeAccountId) {
    return {
      stripeAccountId: null,
      stripeOnboardingComplete: false,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      stripeDetailsSubmitted: false,
      stripeDefaultCurrency: null,
    };
  }

  const account = await stripe.accounts.retrieve(clinic.stripeAccountId);

  const data = {
    stripeOnboardingComplete: account.charges_enabled && account.details_submitted ? true : false,
    stripeChargesEnabled: account.charges_enabled ?? false,
    stripePayoutsEnabled: account.payouts_enabled ?? false,
    stripeDetailsSubmitted: account.details_submitted ?? false,
    stripeDefaultCurrency: account.default_currency ?? "usd",
  };

  await prisma.clinic.update({
    where: { id: clinicId },
    data,
  });

  return {
    stripeAccountId: clinic.stripeAccountId,
    ...data,
  };
}

export async function syncAccountStatusByStripeId(stripeAccountId: string): Promise<void> {
  const stripe = getStripe();

  const clinic = await prisma.clinic.findFirst({
    where: { stripeAccountId },
    select: { id: true },
  });

  if (!clinic) return;

  const account = await stripe.accounts.retrieve(stripeAccountId);

  await prisma.clinic.update({
    where: { id: clinic.id },
    data: {
      stripeOnboardingComplete: account.charges_enabled && account.details_submitted ? true : false,
      stripeChargesEnabled: account.charges_enabled ?? false,
      stripePayoutsEnabled: account.payouts_enabled ?? false,
      stripeDetailsSubmitted: account.details_submitted ?? false,
      stripeDefaultCurrency: account.default_currency ?? "usd",
    },
  });
}

export async function getOrCreateStripeCustomer(clinicId: string, patientId: string): Promise<string> {
  const stripe = getStripe();

  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    select: { stripeAccountId: true },
  });

  if (!clinic.stripeAccountId) {
    throw new Error("Clinic has no connected payment account");
  }

  const patient = await prisma.patient.findFirstOrThrow({
    where: { id: patientId, clinicId },
    select: { id: true, stripeCustomerId: true, firstName: true, lastName: true, email: true },
  });

  if (patient.stripeCustomerId) {
    return patient.stripeCustomerId;
  }

  const decrypted = decryptPatientData(patient as Record<string, unknown>);

  const customer = await stripe.customers.create(
    {
      name: `${decrypted.firstName} ${decrypted.lastName}`,
      email: (decrypted.email as string) || undefined,
      metadata: { patientId, clinicId },
    },
    { stripeAccount: clinic.stripeAccountId }
  );

  await prisma.patient.update({
    where: { id: patientId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
