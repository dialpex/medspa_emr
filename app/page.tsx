import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { user } = session;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            MedSpa EMR
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {user.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {user.role}
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-lg bg-white p-8 shadow-sm dark:bg-zinc-800">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Welcome, {user.name}
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              You are logged in as <strong>{user.role}</strong>.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DashboardCard
                title="Patients"
                description="Manage patient records"
                href="/patients"
              />
              <DashboardCard
                title="Calendar"
                description="View and manage appointments"
                href="/calendar"
              />
              <DashboardCard
                title="Charts"
                description="Clinical documentation"
                href="/charts"
              />
            </div>

            <div className="mt-8 rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
              <h3 className="font-medium text-blue-800 dark:text-blue-300">
                Session Info
              </h3>
              <dl className="mt-2 grid gap-1 text-sm text-blue-700 dark:text-blue-400">
                <div className="flex gap-2">
                  <dt className="font-medium">User ID:</dt>
                  <dd className="font-mono">{user.id}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium">Email:</dt>
                  <dd>{user.email}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium">Clinic ID:</dt>
                  <dd className="font-mono">{user.clinicId}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:border-blue-500 hover:bg-blue-50 dark:border-zinc-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
    >
      <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
    </a>
  );
}
