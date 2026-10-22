import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { CustomerFinder } from "@/components/app/customer-finder";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { SharedFooter } from "@/components/app/shared-footer";
import { Button } from "@/components/core/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Find or Create Client — Briitely OS",
};

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
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
          <Button variant="ghost" asChild className="-ml-3">
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link>
          </Button>
          <div>
            <p className="eyebrow">Customers</p>
            <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Find or Create Client</h1>
            <p className="mt-1 text-muted-foreground">Search by name, business, or email.</p>
          </div>
        </div>
        <CustomerFinder initialCustomerId={params.customerId} />
      </main>
      <SharedFooter />
    </div>
  );
}
