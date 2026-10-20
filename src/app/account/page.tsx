import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2, UserRound } from "lucide-react";
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
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground"><UserRound className="h-6 w-6" /></div>
          <div><h1 className="text-3xl font-bold tracking-tight">My Profile</h1><p className="mt-2 text-muted-foreground">Update your name, phone number and password.</p></div>
        </div>
        <ProfileDetailsForm firstName={user.firstName} lastName={user.lastName} phone={phone} email={user.email} />
        <ChangePasswordForm />
      </main>
      <footer className="mt-16 border-t border-border"><div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8"><Building2 className="h-4 w-4" />Inspired Vacations — Business Dashboard</div></footer>
    </div>
  );
}
