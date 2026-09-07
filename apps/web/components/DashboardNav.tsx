"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const baseLinks = [{ href: "/dashboard", label: "Candidates" }];

const adminLinks = [
  { href: "/dashboard/branding", label: "Branding" },
  { href: "/dashboard/team", label: "Team" },
];

export function DashboardNav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const links = user?.role === "COMPANY_ADMIN" ? [...baseLinks, ...adminLinks] : baseLinks;

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <aside className="flex h-screen w-60 flex-col justify-between border-r border-gray-200 bg-white px-4 py-6">
      <div>
        <div className="mb-8 px-2 text-lg font-semibold text-gray-900">White Label Resume</div>
        <nav className="space-y-1">
          {links.map((link) => {
            const active =
              link.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="space-y-3 px-2">
        {user && (
          <div className="text-xs text-gray-500">
            <div className="truncate font-medium text-gray-700">{user.name}</div>
            <div className="truncate">{user.email}</div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
