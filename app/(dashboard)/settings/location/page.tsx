import { getLocationData } from "@/lib/actions/location";
import { LocationForm } from "./location-form";
import { PageCard } from "@/components/ui/page-card";
import { Breadcrumbs, buildBreadcrumbItems } from "@/components/ui/breadcrumbs";

export default async function LocationPage() {
  const data = await getLocationData();
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Breadcrumbs items={buildBreadcrumbItems(
        { label: "System Config", href: "/settings" },
        { label: "Location" }
      )} />
      <PageCard title="Location Details">
        <LocationForm initialData={data} />
      </PageCard>
    </div>
  );
}
