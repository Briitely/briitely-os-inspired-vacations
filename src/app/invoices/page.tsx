import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { SharedFooter } from "@/components/app/shared-footer";
import { InvoiceFlow } from "@/components/app/invoice-flow";
import { Button } from "@/components/core/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Create Invoice — Briitely OS",
};

export default async function InvoicesPage() {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    redirect("/login?redirect=/invoices");
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role} />
      <main className="workspace-shell space-y-8">
        <div className="space-y-5">
          <Button variant="ghost" asChild className="-ml-3">
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link>
          </Button>
          <div>
            <p className="eyebrow">Invoices</p>
            <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Create Invoice</h1>
            <p className="mt-1 text-muted-foreground">Choose products for this customer.</p>
          </div>
        </div>
        <InvoiceFlow />
      </main>
      <SharedFooter />
    </div>
  );
}
