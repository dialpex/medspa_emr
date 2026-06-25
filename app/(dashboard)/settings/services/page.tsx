import { getServicesForClinic, getTemplateOptions } from "@/lib/actions/services";
import { ServicesClient } from "./services-client";
import { Breadcrumbs, buildBreadcrumbItems } from "@/components/ui/breadcrumbs";

export default async function ServicesPage() {
  const [services, templates] = await Promise.all([
    getServicesForClinic(),
    getTemplateOptions(),
  ]);

  return (
    <>
      <div className="p-6 pb-0 max-w-6xl mx-auto">
        <Breadcrumbs items={buildBreadcrumbItems(
          { label: "System Config", href: "/settings" },
          { label: "Services" }
        )} />
      </div>
      <ServicesClient
        services={services}
        templates={templates}
      />
    </>
  );
}
