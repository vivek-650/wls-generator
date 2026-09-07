import { AdminGuard } from "@/components/AdminGuard";
import { AdminNav } from "@/components/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-gray-50">
        <AdminNav />
        <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
      </div>
    </AdminGuard>
  );
}
