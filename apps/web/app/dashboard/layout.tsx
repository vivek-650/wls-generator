"use client";

import { AppShell } from "@/components/AppShell";
import { DashboardGuard } from "@/components/DashboardGuard";
import { useAuth } from "@/lib/auth-context";
import { Palette, Settings, UserCog, Users } from "lucide-react";
import type { SidebarLink } from "@/components/Sidebar";

const mainLinks: SidebarLink[] = [{ href: "/dashboard", label: "Candidates", icon: Users }];

const adminBottomLinks: SidebarLink[] = [
  { href: "/dashboard/settings/branding", label: "Branding", icon: Palette },
  { href: "/dashboard/settings/team", label: "Team", icon: UserCog },
];

const settingsLink: SidebarLink = { href: "/dashboard/settings", label: "Settings", icon: Settings, matchPrefix: true };

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "COMPANY_ADMIN";
  const bottomLinks = isAdmin ? [...adminBottomLinks, settingsLink] : [settingsLink];

  return (
    <AppShell
      brand="White Label Resume"
      links={mainLinks}
      bottomLinks={bottomLinks}
      bottomLabel="Workspace"
      storageKey="wlr-dashboard-sidebar-collapsed"
    >
      {children}
    </AppShell>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardGuard>
      <DashboardShell>{children}</DashboardShell>
    </DashboardGuard>
  );
}
