"use client";

import { AdminGuard } from "@/components/AdminGuard";
import { AppShell } from "@/components/AppShell";
import { Building2, LayoutDashboard } from "lucide-react";
import type { SidebarLink } from "@/components/Sidebar";

const links: SidebarLink[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/companies", label: "Companies", icon: Building2, matchPrefix: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AppShell brand="Platform Admin" links={links} storageKey="wlr-admin-sidebar-collapsed">
        {children}
      </AppShell>
    </AdminGuard>
  );
}
