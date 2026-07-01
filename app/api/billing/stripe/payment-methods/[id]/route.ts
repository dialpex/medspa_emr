import { NextResponse } from "next/server";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { removePaymentMethod } from "@/lib/services/stripe-payments";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("invoices", "edit");
    const { id } = await params;

    await removePaymentMethod(user.clinicId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove payment method" },
      { status: 500 }
    );
  }
}
