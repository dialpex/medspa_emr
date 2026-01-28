"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Calendar,
  Users,
  Tag,
  Bell,
  BarChart3,
  Package,
  Gift,
  Settings,
  Sparkles,
  LayoutGrid,
  MessageCircle,
  ChevronDown,
} from "lucide-react";
import type { Role } from "@prisma/client";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: Role[];
};

const navItems: NavItem[] = [
  { label: "Calendar", href: "/calendar", icon: <Calendar className="size-4" /> },
  { label: "Patients", href: "/patients", icon: <Users className="size-4" /> },
  { label: "Sales", href: "/sales", icon: <Tag className="size-4" />, roles: ["Owner", "Admin", "Billing"] },
  { label: "Inbox", href: "/inbox", icon: <Bell className="size-4" /> },
  { label: "Reports", href: "/reports", icon: <BarChart3 className="size-4" />, roles: ["Owner", "Admin", "Billing", "MedicalDirector"] },
  { label: "AI Marketing", href: "/marketing", icon: <Sparkles className="size-4" /> },
  { label: "Settings", href: "/settings", icon: <Settings className="size-4" /> },
];

export function NavBar({ user }: { user: { name: string; role: Role } }) {
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) =>
    !item.roles || item.roles.includes(user.role)
  );

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-gradient-to-b from-purple-50 to-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Logo + Navigation */}
        <div className="flex items-center gap-2">
          {/* Logo */}
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white font-bold text-lg mr-2">
            M
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1">
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  isActive(item.href)
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side: Apps, Messages, User */}
        <div className="flex items-center gap-3">
          {/* Apps button */}
          <button className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            <LayoutGrid className="size-4" />
            Apps
          </button>

          {/* Messages */}
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
            <MessageCircle className="size-5" />
          </button>

          {/* User profile */}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 hover:bg-gray-100 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-400 text-white text-sm font-medium">
              {user.name.charAt(0)}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900 leading-tight">{user.name}</p>
              <p className="text-xs text-gray-500 leading-tight">{user.role}</p>
            </div>
            <ChevronDown className="size-4 text-gray-400" />
          </button>
        </div>
      </div>
    </header>
  );
}
