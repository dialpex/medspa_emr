import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPayments } from "@/lib/actions/payments";
import { PageCard } from "@/components/ui/page-card";
import { RevenueView } from "./revenue-view";

const ALLOWED_ROLES = ["Owner", "Admin", "Billing", "MedicalDirector"];

export default async function ReportsPage() {
  const session = await auth();

  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    redirect("/calendar");
  }

  const payments = await getPayments();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageCard title="Analytics" label="Revenue">
        <RevenueView payments={payments} />
      </PageCard>
    </div>
  );
}
