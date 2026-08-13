import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getRecentActivity } from "@/lib/logging/activity";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { WorkflowCard } from "@/components/app/workflow-card";
import { RecentWork } from "@/components/app/recent-work";
import { getBusinessSettings } from "@/lib/briitely/client-settings";
import { UserSearch, BarChart3, Building2, ShieldCheck } from "lucide-react";

export default async function DashboardPage() {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    redirect("/login");
  }

  const recentWork = await getRecentActivity(user.id, 8);
  const business = await getBusinessSettings();

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderWrapper
        fullName={user.fullName}
        email={user.email}
        role={user.role}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            Welcome back, {user.fullName.split(" ")[0]}
          </h2>
          <p className="text-muted-foreground text-base">
            Find a customer to create invoices, record payments, or view history.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <WorkflowCard
            icon={<BarChart3 className="h-7 w-7" />}
            title="Revenue Dashboard"
            description="View sales, receivables, taxes, commissions, and sales by person."
            href="/revenue"
            enabled
          />
          <WorkflowCard
            icon={<UserSearch className="h-7 w-7" />}
            title="Find or Create Customer"
            description="Look up an existing customer or add a new one to your records."
            href="/customers"
            enabled
          />
          {(user.role === "admin" || user.role === "super_admin") && (
            <WorkflowCard
              icon={<ShieldCheck className="h-7 w-7" />}
              title="Admin"
              description="Manage users, business settings, and invoice preferences."
              href="/admin"
              enabled
            />
          )}
        </div>

        <RecentWork events={recentWork} />
      </main>

      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>{business.businessName} — Business Dashboard</span>
        </div>
      </footer>
    </div>
  );
}
