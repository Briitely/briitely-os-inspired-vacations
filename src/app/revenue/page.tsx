import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { SharedFooter } from "@/components/app/shared-footer";
import { RevenueDashboard } from "@/components/core/revenue/RevenueDashboard";
import Link from "next/link";

export default async function RevenuePage() {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    redirect("/login");
  }
  if (!can(user.role, "revenue.view")) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderWrapper
        fullName={user.fullName}
        email={user.email}
        role={user.role}
      />

      <main className="workspace-shell space-y-8">
        <div className="flex items-center gap-4">
        </div>

        <RevenueDashboard />
      </main>

      <SharedFooter />
    </div>
  );
}
