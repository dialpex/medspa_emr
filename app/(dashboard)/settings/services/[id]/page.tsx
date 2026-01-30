import { notFound } from "next/navigation";
import { getService, getTemplateOptions } from "@/lib/actions/services";
import { ServiceForm } from "../service-form";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [service, templates] = await Promise.all([
    getService(id),
    getTemplateOptions(),
  ]);
  if (!service) notFound();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Service</h1>
      <ServiceForm service={service} templates={templates} />
    </div>
  );
}
