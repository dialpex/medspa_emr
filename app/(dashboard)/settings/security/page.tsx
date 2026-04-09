import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SecuritySettings } from "./security-settings";

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { totpEnabled: true, totpVerifiedAt: true },
  });

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Security Settings</h1>
      <SecuritySettings mfaEnabled={user.totpEnabled} />
    </div>
  );
}
