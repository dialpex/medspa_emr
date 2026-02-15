import { requirePermission } from "@/lib/rbac";
import { TemplateForm } from "../template-form";
import { PageCard } from "@/components/ui/page-card";
import type { TemplateFieldConfig } from "@/lib/types/charts";

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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageCard title="New Chart or Form">
        <TemplateForm initialFields={initialFields} importMeta={importMeta} />
      </PageCard>
    </div>
  );
}
