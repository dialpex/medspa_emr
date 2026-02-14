import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { getTotalUnreadCount } from "@/lib/actions/messaging";
import { prisma } from "@/lib/prisma";
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

  const [inboxUnreadCount, clinic] = await Promise.all([
    getTotalUnreadCount().catch(() => 0),
    prisma.clinic.findUnique({
      where: { id: session.user.clinicId },
      select: { name: true, logoUrl: true },
    }),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={user}
        inboxUnreadCount={inboxUnreadCount}
        clinicLogo={clinic?.logoUrl}
        clinicName={clinic?.name ?? "Clinic"}
      />
      <main className="flex-1 min-w-0 bg-gray-50">{children}</main>
    </div>
  );
}
