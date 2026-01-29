import { requirePermission } from "@/lib/rbac";
import { TemplateForm } from "../template-form";

export default async function NewTemplatePage() {
  await requirePermission("charts", "create");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Chart Template</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <TemplateForm />
      </div>
    </div>
  );
}
