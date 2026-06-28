import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getTemplate } from "@/lib/actions/chart-templates";
import { TemplateForm } from "../template-form";
import { getLocationData } from "@/lib/actions/location";
import { Breadcrumbs, buildBreadcrumbItems } from "@/components/ui/breadcrumbs";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePermission("charts", "edit");

  const template = await getTemplate(id);
  if (!template) notFound();

  const locationData = await getLocationData();
  const clinicLogoUrl = locationData.logoUrl || undefined;

  return (
    <div className="h-screen">
      <div className="px-6 pt-4">
        <Breadcrumbs items={buildBreadcrumbItems(
          { label: "System Config", href: "/settings" },
          { label: "Templates", href: "/settings/templates" },
          { label: template.name }
        )} />
      </div>
      <TemplateForm template={template} clinicLogoUrl={clinicLogoUrl} />
    </div>
  );
}
