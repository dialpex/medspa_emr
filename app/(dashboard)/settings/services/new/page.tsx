import { getTemplateOptions } from "@/lib/actions/services";
import { ServiceForm } from "../service-form";

export default async function NewServicePage() {
  const templates = await getTemplateOptions();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Add Service</h1>
      <ServiceForm templates={templates} />
    </div>
  );
}
