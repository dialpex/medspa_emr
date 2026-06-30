import { NextResponse } from "next/server";
import { requirePermission, AuthorizationError } from "@/lib/rbac";
import { collectDeposit } from "@/lib/services/stripe-deposits";
import { depositSchema } from "@/lib/stripe/validation";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await requirePermission("invoices", "edit");
    const body = await request.json();
    const parsed = depositSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { appointmentId, amount: requestedAmount } = parsed.data;

    // Verify appointment belongs to clinic
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId: user.clinicId, deletedAt: null },
      select: { patientId: true },
    });

    if (!appointment || !appointment.patientId) {
      return NextResponse.json({ error: "Appointment not found or has no patient" }, { status: 404 });
    }

    // Use clinic's default deposit amount if none specified
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: user.clinicId },
      select: { defaultDepositAmount: true, depositEnabled: true },
    });

    if (!clinic.depositEnabled) {
      return NextResponse.json({ error: "Deposits are not enabled for this clinic" }, { status: 400 });
    }

    const depositAmount = requestedAmount ?? clinic.defaultDepositAmount;
    if (!depositAmount || depositAmount <= 0) {
      return NextResponse.json({ error: "No deposit amount configured" }, { status: 400 });
    }

    const result = await collectDeposit(user.clinicId, appointment.patientId, appointmentId, depositAmount);

    return NextResponse.json({ clientSecret: result.clientSecret, paymentId: result.paymentId });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create deposit" },
      { status: 500 }
    );
  }
}
