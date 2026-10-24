import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { CustomerFinder } from "@/components/app/customer-finder";
import { can } from "@/lib/auth/permissions";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { SharedFooter } from "@/components/app/shared-footer";
import { Button } from "@/components/core/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Find or Create Client — Briitely OS",
};

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ customerId?: string; deleted?: string }> }) {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    redirect("/login?redirect=/customers");
  }

  const params = await searchParams;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role} />
      <main className="workspace-shell space-y-8">
        <div className="space-y-5">
          <div>
            <p className="eyebrow">Clients</p>
            <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Find or Create Client</h1>
            <p className="mt-1 text-muted-foreground">Search by name, business, or email.</p>
          </div>
        </div>
        {params.deleted && <p role="status" className="rounded-lg border border-border bg-card px-4 py-3 text-sm">Deleted {params.deleted}. They&apos;re gone from the dashboard and from Briitely.</p>}
        <CustomerFinder initialCustomerId={params.customerId} showHiddenOption={can(user.role, "records.delete")} />
      </main>
      <SharedFooter />
    </div>
  );
}
