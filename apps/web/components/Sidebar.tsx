"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

export interface SidebarLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Defaults to exact match; set true to also match nested routes (e.g. /admin/companies/123). */
  matchPrefix?: boolean;
}

interface SidebarProps {
  brand: string;
  links: SidebarLink[];
  /** Rendered above the user/logout block under a small caption, separate from the main nav (e.g. a "Workspace" -> Settings group). */
  bottomLinks?: SidebarLink[];
  bottomLabel?: string;
  /** Distinct localStorage key per shell (dashboard vs admin) so collapse state doesn't bleed across them. */
  storageKey: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function isActive(pathname: string, link: SidebarLink): boolean {
  return link.matchPrefix ? pathname.startsWith(link.href) : pathname === link.href;
}

function NavLink({ link, collapsed, active }: { link: SidebarLink; collapsed: boolean; active: boolean }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      title={collapsed ? link.label : undefined}
      className={`flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm font-medium transition-colors ${
        collapsed ? "justify-center" : ""
      } ${active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{link.label}</span>}
    </Link>
  );
}

export function Sidebar({
  brand,
  links,
  bottomLinks = [],
  bottomLabel,
  storageKey,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "1") setCollapsed(true);
  }, [storageKey]);

  useEffect(() => {
    onCloseMobile();
    // Only re-run when the route actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(storageKey, next ? "1" : "0");
      return next;
    });
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const navContent = (
    <>
      <div className={`flex items-center gap-2 px-3 py-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && <span className="truncate text-sm font-semibold text-slate-900">{brand}</span>}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden shrink-0 rounded-sm p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          className="inline-flex shrink-0 rounded-sm p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 px-2">
        {links.map((link) => (
          <NavLink key={link.href} link={link} collapsed={collapsed} active={isActive(pathname, link)} />
        ))}
      </nav>

      {bottomLinks.length > 0 && (
        <div className="space-y-0.5 px-2 pb-2">
          {!collapsed && bottomLabel && (
            <div className="px-2.5 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {bottomLabel}
            </div>
          )}
          {bottomLinks.map((link) => (
            <NavLink key={link.href} link={link} collapsed={collapsed} active={isActive(pathname, link)} />
          ))}
        </div>
      )}

      <div className="space-y-2 border-t border-slate-100 px-2 py-3">
        {user && !collapsed && (
          <div className="px-2.5 text-xs">
            <div className="truncate font-medium text-slate-700">{user.name}</div>
            <div className="truncate text-slate-400">{user.email}</div>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? "Log out" : undefined}
          className={`flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile drawer + overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={onCloseMobile} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">{navContent}</aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-150 lg:flex ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        {navContent}
      </aside>
    </>
  );
}
