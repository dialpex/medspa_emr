import Link from "next/link";
import { FileTextIcon, UserIcon } from "lucide-react";

const settingsItems = [
  {
    label: "Forms & Charts",
    description: "Manage chart templates and form configurations",
    href: "/settings/templates",
    icon: FileTextIcon,
  },
  {
    label: "Account",
    description: "Your profile and account settings",
    href: "/settings/account",
    icon: UserIcon,
  },
];

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {settingsItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-start gap-4 p-5 bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <item.icon className="size-5" />
            </div>
            <div>
              <div className="font-medium text-gray-900">{item.label}</div>
              <div className="text-sm text-gray-500 mt-0.5">{item.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
