import {
  getNotificationTemplates,
  getClinicPreviewData,
} from "@/lib/actions/notifications";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { FeatureGate } from "@/components/feature-gate";
import { NotificationsClient } from "./notifications-client";
import { Breadcrumbs, buildBreadcrumbItems } from "@/components/ui/breadcrumbs";

export default async function NotificationsPage() {
  if (!(await isFeatureEnabled("notification_automation"))) {
    return <FeatureGate feature="notification_automation" />;
  }

  const [templates, clinicPreview] = await Promise.all([
    getNotificationTemplates(),
    getClinicPreviewData(),
  ]);

  return (
    <>
      <div className="p-6 pb-0 max-w-6xl mx-auto">
        <Breadcrumbs items={buildBreadcrumbItems(
          { label: "System Config", href: "/settings" },
          { label: "Notifications" }
        )} />
      </div>
      <NotificationsClient
        templates={templates}
        clinicPreview={clinicPreview}
      />
    </>
  );
}
