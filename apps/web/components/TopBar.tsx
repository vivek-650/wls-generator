"use client";

import { CommandSearch } from "@/components/CommandSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { ProfileMenu } from "@/components/ProfileMenu";
import { Menu } from "lucide-react";

export function TopBar({ brand, onOpenMobileMenu }: { brand: string; onOpenMobileMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="rounded-sm p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <span className="truncate text-sm font-semibold text-slate-900 lg:hidden">{brand}</span>

      <div className="flex flex-1 justify-end sm:justify-start">
        <CommandSearch />
      </div>

      <div className="flex items-center gap-1">
        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
  );
}
