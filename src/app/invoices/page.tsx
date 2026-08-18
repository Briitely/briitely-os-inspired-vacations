import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
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
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-5">
          <Button variant="ghost" asChild className="-ml-3">
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link>
          </Button>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><FileText className="h-6 w-6" /></div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>
              <p className="mt-2 text-base text-muted-foreground">Choose products for this customer.</p>
            </div>
          </div>
        </div>
        <InvoiceFlow />
      </main>
      <SharedFooter maxWidth="max-w-4xl" />
    </div>
  );
}
