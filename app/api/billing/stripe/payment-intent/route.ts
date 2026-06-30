import { NextResponse } from "next/server";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { createPaymentIntent } from "@/lib/services/stripe-payments";
import { createAuditLog } from "@/lib/audit";
import { paymentIntentSchema } from "@/lib/stripe/validation";

export async function POST(request: Request) {
  try {
    const user = await requirePermission("invoices", "edit");
    const body = await request.json();
    const parsed = paymentIntentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { invoiceId, amount } = parsed.data;

    // Look up the invoice to get patientId
    const { prisma } = await import("@/lib/prisma");
    const invoice = await prisma.invoice.findFirstOrThrow({
      where: { id: invoiceId, clinicId: user.clinicId, deletedAt: null },
      select: { patientId: true },
    });

    const result = await createPaymentIntent(user.clinicId, invoiceId, invoice.patientId, amount);

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "StripePaymentCreate",
      entityType: "Payment",
      entityId: result.paymentId,
      details: JSON.stringify({ invoiceId, amount }),
    });

    return NextResponse.json({ clientSecret: result.clientSecret });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
