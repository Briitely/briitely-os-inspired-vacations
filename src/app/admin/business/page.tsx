import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { SharedFooter } from "@/components/app/shared-footer";
import { BusinessSettingsForm } from "@/components/app/business-settings-form";
import { getBusinessSettings, getRegionalSettings, getGoLiveDate, getBrandingSettings } from "@/lib/briitely/client-settings";
import { Card, CardContent } from "@/components/core/ui/card";
import { ArrowLeft, Lock } from "lucide-react";

export default async function AdminBusinessPage() {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    redirect("/login");
  }

  if (user.role !== "admin" && user.role !== "super_admin") {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role} />
        <main className="workspace-shell space-y-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <Lock className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-base text-foreground font-medium">You do not have permission to access this area.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const [business, regional, goLiveDate, branding] = await Promise.all([
    getBusinessSettings(),
    getRegionalSettings(),
    getGoLiveDate(),
    getBrandingSettings(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role} />

      <main className="workspace-shell space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Admin</span>
          </Link>
        </div>

        <div className="space-y-1">
          <p className="eyebrow">Admin</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">Business Settings</h1>
          <p className="text-sm text-muted-foreground">Update your business identity, branding and regional preferences.</p>
        </div>

        <BusinessSettingsForm
          business={business}
          regional={regional}
          goLiveDate={goLiveDate}
          branding={branding}
        />
      </main>

      <SharedFooter />
    </div>
  );
}
