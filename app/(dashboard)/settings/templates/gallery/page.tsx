import { requirePermission } from "@/lib/rbac";
import { PageCard } from "@/components/ui/page-card";
import { TemplateGallery } from "./template-gallery";
import { Breadcrumbs, buildBreadcrumbItems } from "@/components/ui/breadcrumbs";

export default async function GalleryPage() {
  await requirePermission("charts", "view");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Breadcrumbs items={buildBreadcrumbItems(
        { label: "System Config", href: "/settings" },
        { label: "Templates", href: "/settings/templates" },
        { label: "Gallery" }
      )} />
      <PageCard
        title="Template Gallery"
      >
        <p className="text-sm text-gray-500 mb-5">
          Browse pre-built templates for common medspa procedures. Preview and install any template to get started quickly.
        </p>
        <TemplateGallery />
      </PageCard>
    </div>
  );
}
