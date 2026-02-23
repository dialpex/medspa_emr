import Link from "next/link";
import { FileTextIcon, SparklesIcon, TagIcon, HomeIcon, UsersIcon, BoxIcon, BellIcon } from "lucide-react";
import { PageCard } from "@/components/ui/page-card";
import { auth } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { FeatureFlagsButton } from "./feature-flags-button";
import type { FeatureFlag } from "@/lib/feature-flags-core";
import type { Role } from "@prisma/client";

const settingsItems: Array<{
  label: string;
  description: string;
  href: string;
  icon: typeof FileTextIcon;
  feature?: FeatureFlag;
}> = [
  {
    label: "Forms & Charts",
    description: "Manage chart templates and form configurations",
    href: "/settings/templates",
    icon: FileTextIcon,
  },
  {
    label: "Services",
    description: "Manage treatments, pricing, and service catalog",
    href: "/settings/services",
    icon: SparklesIcon,
  },
  {
    label: "Products",
    description: "Manage retail products, inventory, and pricing",
    href: "/settings/products",
    icon: TagIcon,
  },
  {
    label: "Resources",
    description: "Manage rooms and equipment for scheduling",
    href: "/settings/resources",
    icon: BoxIcon,
  },
  {
    label: "Patient Notifications",
    description: "Appointment reminders & follow-ups",
    href: "/settings/notifications",
    icon: BellIcon,
    feature: "notification_automation",
  },
  {
    label: "Location Details",
    description: "Business info, hours, social accounts, and calendar settings",
    href: "/settings/location",
    icon: HomeIcon,
  },
  {
    label: "Users",
    description: "Manage staff accounts, roles, and permissions",
    href: "/settings/users",
    icon: UsersIcon,
  },
];

export default async function SettingsPage() {
  const [notificationsEnabled, session] = await Promise.all([
    isFeatureEnabled("notification_automation"),
    auth(),
  ]);
  const visibleItems = settingsItems.filter(
    (item) => !item.feature || (item.feature === "notification_automation" && notificationsEnabled)
  );

  const canManageFlags = ["Owner", "Admin"].includes(session?.user?.role as Role);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageCard
        title="Settings"
        headerAction={canManageFlags ? <FeatureFlagsButton /> : undefined}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center text-center aspect-square p-5 bg-gray-50 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all justify-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50 text-purple-600 mb-3">
                <item.icon className="size-6" />
              </div>
              <div className="font-medium text-gray-900">{item.label}</div>
              <div className="text-xs text-gray-500 mt-1">{item.description}</div>
            </Link>
          ))}
        </div>
      </PageCard>
    </div>
  );
}
