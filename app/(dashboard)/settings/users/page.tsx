import Link from "next/link";
import { getUsersForClinic } from "@/lib/actions/users";
import { ToggleActiveButton } from "./toggle-active-button";
import { PageCard } from "@/components/ui/page-card";

const ROLE_COLORS: Record<string, string> = {
  Owner: "bg-purple-50 text-purple-700",
  Admin: "bg-blue-50 text-blue-700",
  Provider: "bg-green-50 text-green-700",
  FrontDesk: "bg-yellow-50 text-yellow-700",
  Billing: "bg-orange-50 text-orange-700",
  MedicalDirector: "bg-red-50 text-red-700",
  ReadOnly: "bg-gray-100 text-gray-600",
};

export default async function UsersPage() {
  const users = await getUsersForClinic();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageCard
        label="Configuration"
        title="Users"
        headerAction={
          <Link
            href="/settings/users/new"
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
          >
            Add User
          </Link>
        }
      >
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No users yet. Add your first user to get started.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/settings/users/${u.id}`}
                      className="font-medium text-gray-900 hover:text-purple-600"
                    >
                      {u.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        ROLE_COLORS[u.role] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <ToggleActiveButton userId={u.id} isActive={u.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageCard>
    </div>
  );
}
