import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MFA_REQUIRED_ROLES } from "@/lib/auth.config";
import { SecuritySettings } from "./security-settings";

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { totpEnabled: true, totpVerifiedAt: true },
  });

  const params = await searchParams;
  const mfaRequired = MFA_REQUIRED_ROLES.includes(session.user.role);
  const showEnrollmentBanner =
    mfaRequired && !user.totpEnabled && params.reason === "mfa-required";

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Security Settings</h1>
      {showEnrollmentBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-amber-800 font-medium">
            MFA is required for your role ({session.user.role})
          </p>
          <p className="text-amber-700 text-sm mt-1">
            Please set up two-factor authentication to continue using the application.
          </p>
        </div>
      )}
      <SecuritySettings mfaEnabled={user.totpEnabled} />
    </div>
  );
}
