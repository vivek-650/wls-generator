"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ErrorBanner } from "@/components/Banner";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { FullPageSpinner } from "@/components/Spinner";
import { ApiError, companyApi } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import type { Company } from "@wlr/shared-types";
import { ChevronRight, Palette, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const LINK_CARDS = [
  {
    href: "/dashboard/settings/branding",
    icon: Palette,
    title: "Branding",
    description: "Logo, theme color, and footer text shown on every exported resume.",
    adminOnly: true,
  },
  {
    href: "/dashboard/settings/team",
    icon: Users,
    title: "Team",
    description: "Who has access to this workspace.",
    adminOnly: true,
  },
  {
    href: "/dashboard/settings/roles",
    icon: ShieldCheck,
    title: "Roles & permissions",
    description: "What Admins and Members can each do.",
    adminOnly: false,
  },
] as const;

export default function SettingsHubPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "COMPANY_ADMIN";
  const [company, setCompany] = useState<Company | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    companyApi
      .get()
      .then((c) => {
        if (!cancelled) setCompany(c);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Failed to load workspace.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!company && !loadError) return <FullPageSpinner />;
  if (!user) return <FullPageSpinner />;

  const initial = (user.name || user.email || "?").slice(0, 1).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <PageHeader title="Settings" description="Your account and this workspace." />

      {loadError && <ErrorBanner message={loadError} />}

      <Card>
        <CardHeader title="Profile" />
        <CardBody className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback className="bg-brand-100 text-brand-700">{initial}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <StatusBadge tone={isAdmin ? "brand" : "neutral"}>{isAdmin ? "Admin" : "Member"}</StatusBadge>
        </CardBody>
      </Card>

      {company && (
        <Card>
          <CardHeader title="Workspace" />
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Name</span>
              <span className="font-medium text-slate-900">{company.companyName}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Your role</span>
              <span className="font-medium text-slate-900">{isAdmin ? "Admin" : "Member"}</span>
            </div>
            <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
              Every company-scoped query is bound through <code className="text-slate-500">withCompanyScope()</code>
              {" "}
              — there&apos;s no code path that reads or writes another company&apos;s data without it.
            </p>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {LINK_CARDS.filter((card) => !card.adminOnly || isAdmin).map((card) => (
          <Link key={card.href} href={card.href}>
            <Card className="flex h-full items-start gap-3 p-4 transition-colors hover:border-slate-300">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-brand-50 text-brand-600">
                <card.icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{card.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{card.description}</p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
