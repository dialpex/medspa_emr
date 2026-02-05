import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageCard } from "@/components/ui/page-card";

const ALLOWED_ROLES = ["Owner", "Admin", "Billing", "MedicalDirector"];

export default async function ReportsPage() {
  const session = await auth();

  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    redirect("/calendar");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageCard label="Analytics" title="Reports">
        <div className="py-12 text-center text-gray-400">
          Reports coming soon...
        </div>
      </PageCard>
    </div>
  );
}
