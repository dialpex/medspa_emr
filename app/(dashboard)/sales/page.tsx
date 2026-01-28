import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = ["Owner", "Admin", "Billing"];

export default async function SalesPage() {
  const session = await auth();

  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    redirect("/calendar");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Sales</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        Sales information coming soon...
      </div>
    </div>
  );
}
