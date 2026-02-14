"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useRef, useState, useEffect, useCallback } from "react";
import {
  Calendar,
  ClipboardList,
  Users,
  Tag,
  Bell,
  BarChart3,
  Settings,
  TrendingUp,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  User,
  HelpCircle,
  LogOut,
} from "lucide-react";
import type { Role } from "@prisma/client";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: Role[];
  badge?: number;
};

const navItems: NavItem[] = [
  { label: "AI Assist", href: "/ai-assist", icon: <Sparkles className="size-5" />, roles: ["Owner", "Admin", "Provider", "FrontDesk", "Billing", "MedicalDirector"] },
  { label: "Today", href: "/today", icon: <ClipboardList className="size-5" /> },
  { label: "Calendar", href: "/calendar", icon: <Calendar className="size-5" /> },
  { label: "Patients", href: "/patients", icon: <Users className="size-5" /> },
  { label: "Sales", href: "/sales", icon: <Tag className="size-5" />, roles: ["Owner", "Admin", "Billing"] },
  { label: "Inbox", href: "/inbox", icon: <Bell className="size-5" />, roles: ["Owner", "Admin", "FrontDesk", "Provider"] },
  { label: "Reports", href: "/reports", icon: <BarChart3 className="size-5" />, roles: ["Owner", "Admin", "Billing", "MedicalDirector"] },
  { label: "AI Marketing", href: "/marketing", icon: <TrendingUp className="size-5" /> },
  { label: "Settings", href: "/settings", icon: <Settings className="size-5" /> },
];

const STORAGE_KEY = "sidebar-collapsed";

export function Sidebar({
  user,
  inboxUnreadCount,
}: {
  user: { name: string; role: Role };
  inboxUnreadCount?: number;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);
  const [animateIndicator, setAnimateIndicator] = useState(false);

  const visibleItems = navItems
    .filter((item) => !item.roles || item.roles.includes(user.role))
    .map((item) => {
      if (item.href === "/inbox" && inboxUnreadCount) {
        return { ...item, badge: inboxUnreadCount };
      }
      return item;
    });

  const isActive = useCallback(
    (href: string) => {
      if (href === "/") return pathname === "/";
      if (href === "/settings")
        return pathname === "/settings" || (pathname.startsWith("/settings") && !pathname.startsWith("/settings/account"));
      return pathname.startsWith(href);
    },
    [pathname]
  );

  const updateIndicator = useCallback(() => {
    if (!navRef.current) return;
    const activeHref = visibleItems.find((item) => isActive(item.href))?.href;
    if (!activeHref) {
      setIndicator(null);
      return;
    }
    const el = itemRefs.current.get(activeHref);
    if (!el) return;
    const navRect = navRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setIndicator({ top: elRect.top - navRect.top, height: elRect.height });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, collapsed, isActive]);

  useEffect(() => {
    updateIndicator();
    const raf = requestAnimationFrame(() => setAnimateIndicator(true));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  // Re-measure after collapse/expand transition ends
  useEffect(() => {
    if (!mounted) return;
    const timeout = setTimeout(updateIndicator, 310);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    }
  }, [collapsed, mounted]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const toggleCollapse = () => setCollapsed((v) => !v);

  return (
    <aside
      className={`relative sticky top-0 flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-300 ease-in-out ${
        collapsed ? "w-[68px]" : "w-[240px]"
      }`}
    >
      {/* Collapse/expand toggle — floating circle on the edge */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-3.5 top-5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 transition-colors"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="size-4 text-gray-600" /> : <ChevronLeft className="size-4 text-gray-600" />}
      </button>

      {/* Logo / Brand */}
      <div className={`flex h-14 items-center border-b border-gray-100 px-4 ${collapsed ? "justify-center" : ""}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-sm font-bold">
          M
        </div>
        <span
          className={`ml-3 text-lg font-semibold text-gray-900 whitespace-nowrap transition-opacity duration-300 ${
            collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          }`}
        >
          MedSpa
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
        <ul ref={navRef} className="relative flex flex-col gap-1">
          {/* Sliding active indicator */}
          {indicator && (
            <div
              className="absolute left-0 right-0 rounded-lg bg-purple-50"
              style={{
                top: indicator.top,
                height: indicator.height,
                transition: animateIndicator ? "top 150ms cubic-bezier(0.4, 0, 0.2, 1), height 100ms ease" : "none",
              }}
            />
          )}
          {visibleItems.map((item) => (
            <li
              key={item.href}
              ref={(el) => {
                if (el) itemRefs.current.set(item.href, el);
                else itemRefs.current.delete(item.href);
              }}
            >
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`relative z-[1] flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive(item.href) ? "text-purple-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span
                  className={`whitespace-nowrap transition-opacity duration-300 ${
                    collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                  }`}
                >
                  {item.label}
                </span>
                {item.badge != null && item.badge > 0 && (
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ${
                      collapsed ? "absolute -top-1 -right-1" : "ml-auto"
                    }`}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User section */}
      <div className="relative border-t border-gray-200 px-3 py-3" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-400 text-white text-sm font-medium">
            {user.name.charAt(0)}
          </div>
          <div
            className={`text-left overflow-hidden whitespace-nowrap transition-opacity duration-300 ${
              collapsed ? "opacity-0 w-0" : "opacity-100 flex-1 min-w-0"
            }`}
          >
            <p className="text-sm font-medium text-gray-900 leading-tight truncate">{user.name}</p>
            <p className="text-xs text-gray-500 leading-tight truncate">{user.role.replace(/([a-z])([A-Z])/g, "$1 $2")}</p>
          </div>
        </button>

        {dropdownOpen && (
          <div
            className={`absolute bottom-full mb-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg ${
              collapsed ? "left-full ml-1" : "left-3"
            }`}
          >
            <Link
              href="/settings/account"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <User className="size-4" />
              Account Settings
            </Link>
            <button
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setDropdownOpen(false)}
            >
              <HelpCircle className="size-4" />
              Help
            </button>
            <hr className="my-1 border-gray-100" />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="size-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
