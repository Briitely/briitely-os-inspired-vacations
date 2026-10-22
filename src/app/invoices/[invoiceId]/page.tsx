import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { SharedFooter } from "@/components/app/shared-footer";
import { InvoiceActionsFlow } from "@/components/app/invoice-actions-flow";
import { Button } from "@/components/core/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Invoice Actions — Briitely OS",
};

export default async function InvoiceActionsPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    redirect("/login?redirect=/invoices");
  }

  const { invoiceId } = await params;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role} />
      <main className="workspace-shell space-y-8">
        <div className="space-y-5">
          <Button variant="ghost" asChild className="-ml-3">
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link>
          </Button>
          <div>
            <p className="eyebrow">Invoice</p>
            <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Invoice Actions</h1>
            <p className="mt-1 text-muted-foreground">View, edit, send, or record payment for this invoice.</p>
          </div>
        </div>
        <InvoiceActionsFlow invoiceId={invoiceId} />
      </main>
      <SharedFooter />
    </div>
  );
}
