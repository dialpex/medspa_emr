import { NextResponse } from "next/server";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { getPatientPaymentMethods } from "@/lib/services/stripe-payments";

export async function GET(request: Request) {
  try {
    const user = await requirePermission("invoices", "view");
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }

    const methods = await getPatientPaymentMethods(user.clinicId, patientId);
    return NextResponse.json(methods);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get payment methods" },
      { status: 500 }
    );
  }
}
