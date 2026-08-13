import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { RevenueDashboard } from "@/components/core/revenue/RevenueDashboard";
import { Building2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function RevenuePage() {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderWrapper
        fullName={user.fullName}
        email={user.email}
        role={user.role}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        <RevenueDashboard />
      </main>

      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>Briitely OS — Business Dashboard</span>
        </div>
      </footer>
    </div>
  );
}
