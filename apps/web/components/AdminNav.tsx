"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/companies", label: "Companies" },
];

export function AdminNav() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <aside className="flex h-screen w-60 flex-col justify-between border-r border-gray-200 bg-gray-900 px-4 py-6">
      <div>
        <div className="mb-8 px-2 text-lg font-semibold text-white">Platform Admin</div>
        <nav className="space-y-1">
          {links.map((link) => {
            const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  active ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
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
          <div className="text-xs text-gray-400">
            <div className="truncate font-medium text-gray-200">{user.name}</div>
            <div className="truncate">{user.email}</div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full rounded-md border border-gray-700 px-3 py-2 text-left text-sm font-medium text-gray-300 hover:bg-gray-800"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
