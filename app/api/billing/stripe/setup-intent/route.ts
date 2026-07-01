import { NextResponse } from "next/server";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { getOrCreateStripeCustomer } from "@/lib/services/stripe-connect";
import { getStripe } from "@/lib/stripe/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const user = await requirePermission("invoices", "edit");
    const body = await request.json();
    const { patientId } = body;

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: user.clinicId },
      select: { stripeAccountId: true, stripeChargesEnabled: true },
    });

    if (!clinic.stripeAccountId || !clinic.stripeChargesEnabled) {
      return NextResponse.json({ error: "Card payments are not active for this clinic" }, { status: 400 });
    }

    const customerId = await getOrCreateStripeCustomer(user.clinicId, patientId);
    const stripe = getStripe();

    const setupIntent = await stripe.setupIntents.create(
      {
        customer: customerId,
        automatic_payment_methods: { enabled: true },
        metadata: {
          clinicId: user.clinicId,
          patientId,
        },
      },
      { stripeAccount: clinic.stripeAccountId }
    );

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "StripeSetupIntentCreate",
      entityType: "Patient",
      entityId: patientId,
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create setup intent" },
      { status: 500 }
    );
  }
}
