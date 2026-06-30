import { getPackagesForClinic } from "@/lib/actions/packages";
import { getServicesForClinic } from "@/lib/actions/services";
import { PackagesClient } from "./packages-client";
import { Breadcrumbs, buildBreadcrumbItems } from "@/components/ui/breadcrumbs";

export default async function PackagesPage() {
  const [packages, services] = await Promise.all([
    getPackagesForClinic(),
    getServicesForClinic(),
  ]);

  return (
    <>
      <div className="p-6 pb-0 max-w-6xl mx-auto">
        <Breadcrumbs items={buildBreadcrumbItems(
          { label: "System Config", href: "/settings" },
          { label: "Packages" }
        )} />
      </div>
      <PackagesClient packages={packages} services={services} />
    </>
  );
}
