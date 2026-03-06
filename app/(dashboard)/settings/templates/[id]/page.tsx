import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { getTemplate } from "@/lib/actions/chart-templates";
import { TemplateForm } from "../template-form";
import { getLocationData } from "@/lib/actions/location";

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
    <div className="h-[calc(100vh-64px)]">
      <TemplateForm template={template} clinicLogoUrl={clinicLogoUrl} />
    </div>
  );
}
