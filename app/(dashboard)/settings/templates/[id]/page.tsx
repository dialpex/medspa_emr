import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getTemplate } from "@/lib/actions/chart-templates";
import { TemplateForm } from "../template-form";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePermission("charts", "edit");

  const template = await getTemplate(id);
  if (!template) notFound();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Template</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <TemplateForm template={template} />
      </div>
    </div>
  );
}
