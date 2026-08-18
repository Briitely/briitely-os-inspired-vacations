import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { SharedFooter } from "@/components/app/shared-footer";
import { UsersTable } from "@/components/app/users-table";
import { getBriitelyUsersWithFallback, getBriitelyUserLabel } from "@/lib/briitely/users";
import { Card, CardContent } from "@/components/core/ui/card";
import { ArrowLeft, Lock } from "lucide-react";
import type { Profile } from "@/lib/supabase/types";

export default async function AdminUsersPage() {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    redirect("/login");
  }

  if (user.role !== "admin" && user.role !== "super_admin") {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role} />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
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

  const isSuperAdmin = user.role === "super_admin";

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const [profilesResult, briitelyUsersResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, first_name, last_name, role, is_active, ghl_user_id, created_at, updated_at")
      .order("created_at", { ascending: true }),
    getBriitelyUsersWithFallback(),
  ]);

  const profiles = (profilesResult.data ?? []) as Profile[];
  const briitelyUsers = briitelyUsersResult.users;

  const displayProfiles = profiles.map((p) => {
    const isProtectedSuperAdmin = p.role === "super_admin" && !isSuperAdmin;
    return {
      id: p.id,
      email: p.email ?? "",
      firstName: p.first_name ?? "",
      lastName: p.last_name ?? "",
      fullName: p.full_name ?? ([p.first_name, p.last_name].filter(Boolean).join(" ") || (p.email ?? "")),
      role: p.role,
      isActive: p.is_active,
      ghlLabel: getBriitelyUserLabel(p.ghl_user_id, briitelyUsers),
      isSelf: p.id === user.id,
      canEdit: !isProtectedSuperAdmin,
      canToggleActive: !isProtectedSuperAdmin && p.id !== user.id,
      canChangeRole: !isProtectedSuperAdmin,
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Admin</span>
          </Link>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Users & Access</h2>
            <p className="text-muted-foreground text-base">Manage your team members and their permissions.</p>
          </div>
        </div>

        <UsersTable profiles={displayProfiles} isSuperAdmin={isSuperAdmin} />
      </main>

      <SharedFooter />
    </div>
  );
}
