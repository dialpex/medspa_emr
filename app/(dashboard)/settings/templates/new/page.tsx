import { requirePermission } from "@/lib/rbac";
import { TemplateForm } from "../template-form";
import type { TemplateFieldConfig } from "@/lib/types/charts";
import { getLocationData } from "@/lib/actions/location";
import { Breadcrumbs, buildBreadcrumbItems } from "@/components/ui/breadcrumbs";

interface ImportData {
  fields?: TemplateFieldConfig[];
  name?: string;
  type?: string;
  category?: string;
}

export default async function NewTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string; ai?: string }>;
}) {
  await requirePermission("charts", "create");

  const params = await searchParams;
  let initialFields: TemplateFieldConfig[] | undefined;
  let importMeta: { name?: string; type?: string; category?: string } | undefined;

  const encoded = params.import || params.ai;
  if (encoded) {
    try {
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded) as ImportData | TemplateFieldConfig[];

      if (Array.isArray(parsed)) {
        initialFields = parsed;
      } else {
        initialFields = parsed.fields;
        importMeta = { name: parsed.name, type: parsed.type, category: parsed.category };
      }
    } catch {
      // Ignore invalid data
    }
  }

  const locationData = await getLocationData();
  const clinicLogoUrl = locationData.logoUrl || undefined;

  return (
    <div className="h-[calc(100vh-64px)]">
      <div className="px-6 pt-4">
        <Breadcrumbs items={buildBreadcrumbItems(
          { label: "System Config", href: "/settings" },
          { label: "Templates", href: "/settings/templates" },
          { label: "New" }
        )} />
      </div>
      <TemplateForm initialFields={initialFields} importMeta={importMeta} clinicLogoUrl={clinicLogoUrl} />
    </div>
  );
}
