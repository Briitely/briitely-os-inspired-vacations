import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2, UserRound } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getContact } from "@/lib/briitely/contacts";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { CustomerWorkspace } from "@/components/app/customer-workspace";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent } from "@/components/core/ui/card";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Customer — Briitely OS",
};

export default async function CustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    redirect("/login?redirect=/customers");
  }

  const { customerId } = await params;

  let customer = null;
  let loadError = null;
  try {
    customer = await getContact(customerId);
  } catch {
    loadError = "We couldn't load this customer. Please try again.";
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
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><UserRound className="h-6 w-6" /></div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Customer</h1>
              <p className="mt-2 text-base text-muted-foreground">Manage customer details, invoices, and payments.</p>
            </div>
          </div>
        </div>

        {loadError && !customer && (
          <Card><CardContent className="space-y-4 p-6">
            <p className="text-sm text-destructive" role="alert">{loadError}</p>
            <Button variant="outline" asChild><Link href="/customers"><ArrowLeft className="h-4 w-4" />Back to Customer Search</Link></Button>
          </CardContent></Card>
        )}

        {customer && (
          <CustomerWorkspace
            initialCustomer={customer}
          />
        )}
      </main>
      <footer className="mt-16 border-t border-border">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8"><Building2 className="h-4 w-4" /><span>Briitely OS — Business Dashboard</span></div>
      </footer>
    </div>
  );
}
