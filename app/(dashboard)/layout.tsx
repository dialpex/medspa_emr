import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NavBar } from "@/components/nav-bar";
import { getTotalUnreadCount } from "@/lib/actions/messaging";
import type { Role } from "@prisma/client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = {
    name: session.user.name,
    role: session.user.role as Role,
  };

  const inboxUnreadCount = await getTotalUnreadCount().catch(() => 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar user={user} inboxUnreadCount={inboxUnreadCount} />
      <main>{children}</main>
    </div>
  );
}
