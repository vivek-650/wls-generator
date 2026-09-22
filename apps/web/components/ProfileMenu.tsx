"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { companyApi } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import type { Company } from "@wlr/shared-types";
import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);

  const isCompanyUser = user?.role === "COMPANY_ADMIN" || user?.role === "COMPANY_MEMBER";

  useEffect(() => {
    if (!isCompanyUser) return;
    let cancelled = false;
    companyApi
      .get()
      .then((c) => {
        if (!cancelled) setCompany(c);
      })
      .catch(() => {
        // Non-critical — the menu still works without the workspace name.
      });
    return () => {
      cancelled = true;
    };
  }, [isCompanyUser]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (!user) return null;

  const initial = (user.name || user.email || "?").slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <Avatar>
          <AvatarFallback className="bg-brand-100 text-brand-700">{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium text-slate-900">{user.name}</div>
          <div className="truncate text-xs text-slate-500">{user.email}</div>
        </DropdownMenuLabel>

        {isCompanyUser && (
          <>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between gap-2 px-1.5 py-1">
              <span className="truncate text-sm text-slate-700">{company?.companyName ?? "Workspace"}</span>
              <StatusBadge tone={user.role === "COMPANY_ADMIN" ? "brand" : "neutral"}>
                {user.role === "COMPANY_ADMIN" ? "Admin" : "Member"}
              </StatusBadge>
            </div>
          </>
        )}

        <DropdownMenuSeparator />

        {isCompanyUser && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">
              <User className="h-4 w-4" aria-hidden="true" /> Profile & workspace settings
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onSelect={handleLogout} variant="destructive">
          <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
