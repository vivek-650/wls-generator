import { DashboardGuard } from "@/components/DashboardGuard";
import { DashboardNav } from "@/components/DashboardNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardGuard>
      <div className="flex min-h-screen bg-gray-50">
        <DashboardNav />
        <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
      </div>
    </DashboardGuard>
  );
}
