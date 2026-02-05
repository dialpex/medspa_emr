import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getTemplate } from "@/lib/actions/chart-templates";
import { TemplateForm } from "../template-form";
import { PageCard } from "@/components/ui/page-card";

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
      <PageCard label="Configuration" title="Edit Template">
        <TemplateForm template={template} />
      </PageCard>
    </div>
  );
}
