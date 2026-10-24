import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getContact } from "@/lib/briitely/contacts";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { SharedFooter } from "@/components/app/shared-footer";
import { CustomerWorkspace } from "@/components/app/customer-workspace";
import { DeleteClientCard } from "@/components/app/delete-client-card";
import { can } from "@/lib/auth/permissions";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent } from "@/components/core/ui/card";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Client — Briitely OS",
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
    loadError = "We couldn't load this client. Please try again.";
  }

  return (
    <div className="min-h-screen bg-[#f7f4ff]">
      <DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role} />
      <main className="workspace-shell space-y-6">
        <div className="space-y-5">
          <Button variant="ghost" asChild className="-ml-3">
            <Link href="/customers"><ArrowLeft className="h-4 w-4" />Back to Find or Create Client</Link>
          </Button>
          {customer && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/60">Client file</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{customer.name || customer.companyName || "Client"}</h1>
              {customer.companyName && customer.companyName !== customer.name && <p className="mt-1 text-sm text-muted-foreground">{customer.companyName}</p>}
            </div>
          )}
        </div>

        {loadError && !customer && (
          <Card><CardContent className="space-y-4 p-6">
            <p className="text-sm text-destructive" role="alert">{loadError}</p>
            <Button variant="outline" asChild><Link href="/customers"><ArrowLeft className="h-4 w-4" />Back to Find or Create Client</Link></Button>
          </CardContent></Card>
        )}

        {customer && <CustomerWorkspace initialCustomer={customer} />}
        {customer && can(user.role, "records.delete") && <DeleteClientCard clientId={customer.id} clientName={customer.name || customer.companyName || "this client"} />}
      </main>
      <SharedFooter />
    </div>
  );
}
