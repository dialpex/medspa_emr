import { getRoomsAndResources } from "@/lib/actions/resources";
import { ResourcesClient } from "./resources-client";
import { Breadcrumbs, buildBreadcrumbItems } from "@/components/ui/breadcrumbs";

export default async function ResourcesPage() {
  const items = await getRoomsAndResources();

  return (
    <>
      <div className="p-6 pb-0 max-w-6xl mx-auto">
        <Breadcrumbs items={buildBreadcrumbItems(
          { label: "System Config", href: "/settings" },
          { label: "Resources" }
        )} />
      </div>
      <ResourcesClient items={items} />
    </>
  );
}
