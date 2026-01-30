import { getLocationData } from "@/lib/actions/location";
import { LocationForm } from "./location-form";

export default async function LocationPage() {
  const data = await getLocationData();
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Location Details</h1>
      <LocationForm initialData={data} />
    </div>
  );
}
