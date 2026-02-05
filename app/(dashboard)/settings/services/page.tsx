import { getServicesForClinic, getTemplateOptions } from "@/lib/actions/services";
import { ServicesClient } from "./services-client";

export default async function ServicesPage() {
  const [services, templates] = await Promise.all([
    getServicesForClinic(),
    getTemplateOptions(),
  ]);

  return (
    <ServicesClient
      services={services}
      templates={templates}
    />
  );
}
