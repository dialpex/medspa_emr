"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Role } from "@prisma/client";

type NavItem = {
  label: string;
  href: string;
  roles?: Role[]; // If undefined, visible to all roles
};

const navItems: NavItem[] = [
  { label: "Calendar", href: "/calendar" },
  { label: "Patients", href: "/patients" },
  { label: "Inbox", href: "/inbox" },
  {
    label: "Sales",
    href: "/sales",
    roles: ["Owner", "Admin", "Billing"],
  },
  {
    label: "Reports",
    href: "/reports",
    roles: ["Owner", "Admin", "Billing", "MedicalDirector"],
  },
  { label: "AI Marketing", href: "/marketing" },
  { label: "Settings", href: "/settings" },
];

type NavBarProps = {
  user: {
    name: string;
    role: Role;
  };
};

export function NavBar({ user }: NavBarProps) {
  const pathname = usePathname();

  // Filter nav items based on user role
  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(user.role);
  });

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Navigation Tabs */}
        <nav className="flex h-full items-center gap-1">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex h-full items-center px-4 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {item.label}
              {/* Active indicator */}
              {isActive(item.href) && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 animate-in fade-in slide-in-from-bottom-1 duration-200" />
              )}
            </Link>
          ))}
        </nav>

        {/* User Info & Sign Out */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">{user.role}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
