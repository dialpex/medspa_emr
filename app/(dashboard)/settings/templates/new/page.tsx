import { requirePermission } from "@/lib/rbac";
import { TemplateForm } from "../template-form";
import { PageCard } from "@/components/ui/page-card";

export default async function NewTemplatePage() {
  await requirePermission("charts", "create");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageCard label="Configuration" title="New Chart or Form">
        <TemplateForm />
      </PageCard>
    </div>
  );
}
