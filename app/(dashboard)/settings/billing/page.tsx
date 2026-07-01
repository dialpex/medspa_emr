import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageCard } from "@/components/ui/page-card";
import { BillingClient } from "./billing-client";
import type { Role } from "@prisma/client";

export default async function BillingSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as { id: string; role: Role; clinicId: string };
  const canManage = ["Owner", "Admin"].includes(user.role);

  const clinic = await prisma.clinic.findUniqueOrThrow({
    where: { id: user.clinicId },
    select: {
      name: true,
      stripeAccountId: true,
      stripeOnboardingComplete: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeDetailsSubmitted: true,
      stripeDefaultCurrency: true,
    },
  });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageCard title="Billing & Payments">
        <BillingClient
          clinicName={clinic.name}
          initialStatus={{
            stripeAccountId: clinic.stripeAccountId,
            stripeOnboardingComplete: clinic.stripeOnboardingComplete,
            stripeChargesEnabled: clinic.stripeChargesEnabled,
            stripePayoutsEnabled: clinic.stripePayoutsEnabled,
            stripeDetailsSubmitted: clinic.stripeDetailsSubmitted,
            stripeDefaultCurrency: clinic.stripeDefaultCurrency,
          }}
          canManage={canManage}
        />
      </PageCard>
    </div>
  );
}
