import {
  getNotificationTemplates,
  getClinicPreviewData,
} from "@/lib/actions/notifications";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { FeatureGate } from "@/components/feature-gate";
import { NotificationsClient } from "./notifications-client";

export default async function NotificationsPage() {
  if (!(await isFeatureEnabled("notification_automation"))) {
    return <FeatureGate feature="notification_automation" />;
  }

  const [templates, clinicPreview] = await Promise.all([
    getNotificationTemplates(),
    getClinicPreviewData(),
  ]);

  return (
    <NotificationsClient
      templates={templates}
      clinicPreview={clinicPreview}
    />
  );
}
