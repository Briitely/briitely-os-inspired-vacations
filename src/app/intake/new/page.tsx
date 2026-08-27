import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { SharedFooter } from "@/components/app/shared-footer";
import { StaffIntakeForm } from "@/components/app/staff-intake-form";

export default async function IntakeNewPage() {
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">New Inquiry</h2>
          <p className="text-muted-foreground">
            Enter a new travel inquiry from a phone call, email, referral, or walk-in.
          </p>
        </div>
        <StaffIntakeForm />
      </main>
      <SharedFooter label="New Inquiry" />
    </div>
  );
}
