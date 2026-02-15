import { getLocationData } from "@/lib/actions/location";
import { LocationForm } from "./location-form";
import { PageCard } from "@/components/ui/page-card";

export default async function LocationPage() {
  const data = await getLocationData();
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageCard title="Location Details">
        <LocationForm initialData={data} />
      </PageCard>
    </div>
  );
}
