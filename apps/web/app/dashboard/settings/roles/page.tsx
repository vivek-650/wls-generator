import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/status-badge";
import { ArrowLeft, Check, Shield, User } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

// Grounded directly in the `requireRole(...)` guards in apps/api/src/routes —
// this is not aspirational copy, it's a rendering of what the API actually
// enforces today. Keep this in sync if a route's role guard changes.
const PERMISSION_GROUPS = [
  {
    category: "Candidates",
    rows: [
      { label: "View, upload, edit, export, and delete candidates", admin: true, member: true },
    ],
  },
  {
    category: "Branding",
    rows: [
      { label: "View branding", admin: true, member: true },
      { label: "Edit branding / upload logo", admin: true, member: false },
    ],
  },
  {
    category: "Team",
    rows: [
      { label: "View team members", admin: true, member: false },
      { label: "Add or remove team members", admin: true, member: false },
    ],
  },
];

function PermissionCell({ granted }: { granted: boolean }) {
  return granted ? (
    <Check className="mx-auto h-4 w-4 text-green-600" aria-hidden="true" />
  ) : (
    <span className="mx-auto block text-slate-300">—</span>
  );
}

export default function RolesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Settings
      </Link>

      <PageHeader title="Roles & permissions" description="What Admins and Members can each do in this workspace." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand-600" aria-hidden="true" />
            <span className="text-sm font-semibold text-slate-900">Admin</span>
            <StatusBadge tone="brand">Built-in</StatusBadge>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Full access — candidates, branding, and team management.
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span className="text-sm font-semibold text-slate-900">Member</span>
            <StatusBadge tone="neutral">Built-in</StatusBadge>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Can upload, edit, and export candidates. Cannot manage branding or the team.
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Permission matrix" />
        <CardBody className="overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Permission
                </th>
                <th className="w-20 px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
                  Admin
                </th>
                <th className="w-20 px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
                  Member
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PERMISSION_GROUPS.map((group) => (
                <Fragment key={group.category}>
                  <tr className="bg-slate-50/60">
                    <td colSpan={3} className="px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                      {group.category}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.label}>
                      <td className="px-4 py-2.5 text-slate-700">{row.label}</td>
                      <td className="px-4 py-2.5 text-center">
                        <PermissionCell granted={row.admin} />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <PermissionCell granted={row.member} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <p className="text-xs text-slate-400">
        This workspace currently supports two fixed roles — Admin and Member. Both are enforced directly in the
        API&apos;s route guards, not configurable per-workspace.
      </p>
    </div>
  );
}
