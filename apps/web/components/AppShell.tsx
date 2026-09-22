"use client";

import { Sidebar, type SidebarLink } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { useState } from "react";

interface AppShellProps {
  brand: string;
  links: SidebarLink[];
  bottomLinks?: SidebarLink[];
  bottomLabel?: string;
  storageKey: string;
  children: React.ReactNode;
}

export function AppShell({ brand, links, bottomLinks, bottomLabel, storageKey, children }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <Sidebar
        brand={brand}
        links={links}
        bottomLinks={bottomLinks}
        bottomLabel={bottomLabel}
        storageKey={storageKey}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar brand={brand} onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
