import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getAllTemplates } from "@/lib/actions/chart-templates";

export default async function TemplatesPage() {
  const user = await requirePermission("charts", "view");
  const templates = await getAllTemplates();
  const canManage = user.role === "Owner" || user.role === "Admin";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chart Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure templates for clinical charting
          </p>
        </div>
        {canManage && (
          <Link
            href="/settings/templates/new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
          >
            <PlusIcon className="size-4" />
            New Template
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {templates.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No templates yet. Create one to get started.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fields</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {templates.map((t) => {
                const fieldCount = JSON.parse(t.fieldsConfig).length;
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-gray-500">{t.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {t.category ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {fieldCount} field{fieldCount !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                          t.isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {t.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && (
                        <Link
                          href={`/settings/templates/${t.id}`}
                          className="text-sm text-purple-600 hover:text-purple-700"
                        >
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
