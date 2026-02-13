import {
  getNotificationTemplates,
  getClinicPreviewData,
} from "@/lib/actions/notifications";
import { NotificationsClient } from "./notifications-client";

export default async function NotificationsPage() {
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
