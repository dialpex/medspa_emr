import { getRoomsAndResources } from "@/lib/actions/resources";
import { ResourcesClient } from "./resources-client";

export default async function ResourcesPage() {
  const items = await getRoomsAndResources();

  return <ResourcesClient items={items} />;
}
