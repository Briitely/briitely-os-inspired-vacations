import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { ProfileDetailsForm } from "@/components/app/profile-details-form";
import { ChangePasswordForm } from "@/components/app/change-password-form";

export const metadata: Metadata = { title: "My Profile — Inspired Vacations" };

export default async function MyProfilePage() {
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) redirect("/login?redirect=/account");

  // The phone number isn't part of the session user, so read it separately.
  let phone = "";
  const service = createServiceClient();
  if (service) {
    const { data } = await service.from("profiles").select("phone").eq("id", user.id).maybeSingle();
    phone = data?.phone ?? "";
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role} />
      <main className="workspace-shell space-y-6">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">My Profile</h1>
          <p className="mt-1 text-muted-foreground">Update your name, phone number and password.</p>
        </div>
        <ProfileDetailsForm firstName={user.firstName} lastName={user.lastName} phone={phone} email={user.email} />
        <ChangePasswordForm />
      </main>
      <footer className="mt-16 border-t border-border"><div className="workspace-footer"><Building2 className="h-4 w-4" />Inspired Vacations — Business Dashboard</div></footer>
    </div>
  );
}
