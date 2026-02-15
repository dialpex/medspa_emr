import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { getAllTemplates } from "@/lib/actions/chart-templates";
import { PageCard } from "@/components/ui/page-card";
import { TemplatesList } from "./templates-list";

export default async function TemplatesPage() {
  const user = await requirePermission("charts", "view");
  const templates = await getAllTemplates();
  const canManage = user.role === "Owner" || user.role === "Admin";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageCard
        title="Forms & Charts"
        headerAction={
          canManage ? (
            <div className="flex items-center gap-2">
              {/* Import button is rendered inside TemplatesList as it needs client state for modal */}
              <Link
                href="/settings/templates/new"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
              >
                <PlusIcon className="size-4" />
                New Chart or Form
              </Link>
            </div>
          ) : undefined
        }
      >
        <p className="text-sm text-gray-500 mb-5">
          Create and manage chart templates and forms for clinical documentation, intake, and consents.
        </p>
        <TemplatesList
          templates={templates.map((t) => ({
            id: t.id,
            type: t.type,
            name: t.name,
            description: t.description,
            category: t.category,
            fieldsConfig: t.fieldsConfig,
            status: t.status,
            isSystem: t.isSystem,
          }))}
          canManage={canManage}
        />
      </PageCard>
    </div>
  );
}
