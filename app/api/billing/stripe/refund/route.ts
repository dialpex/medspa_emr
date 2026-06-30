import { NextResponse } from "next/server";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { processRefund } from "@/lib/services/stripe-payments";
import { createAuditLog } from "@/lib/audit";
import { refundSchema } from "@/lib/stripe/validation";

export async function POST(request: Request) {
  try {
    const user = await requirePermission("invoices", "edit");
    const body = await request.json();
    const parsed = refundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { paymentId, amount } = parsed.data;

    const result = await processRefund(user.clinicId, paymentId, amount);

    await createAuditLog({
      clinicId: user.clinicId,
      userId: user.id,
      action: "StripeRefundCreate",
      entityType: "Payment",
      entityId: paymentId,
      details: JSON.stringify({ paymentId, amount, refundId: result.refundId }),
    });

    return NextResponse.json({ success: true, refundId: result.refundId });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process refund" },
      { status: 500 }
    );
  }
}
