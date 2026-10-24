import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getContact } from "@/lib/briitely/contacts";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { SharedFooter } from "@/components/app/shared-footer";
import { CustomerWorkspace } from "@/components/app/customer-workspace";
import { DeleteClientButton } from "@/components/app/delete-client-button";
import { CustomerMoreDetailsCard } from "@/components/core/customer-more-details-card";
import { getCustomerFileFields } from "@/lib/briitely/client-settings";
import { can } from "@/lib/auth/permissions";
import { isHidden } from "@/lib/customers/hidden";
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

  const fileFields = await getCustomerFileFields();
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
              <h1 className="mt-1 flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight">{customer.name || customer.companyName || "Client"}{isHidden(customer.tags) && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hidden</span>}</h1>
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
        {customer && fileFields.fields.length > 0 && <CustomerMoreDetailsCard customerId={customer.id} />}
        {customer && can(user.role, "records.delete") && <DeleteClientButton clientId={customer.id} clientName={customer.name || customer.companyName || "this client"} hidden={isHidden(customer.tags)} />}
      </main>
      <SharedFooter />
    </div>
  );
}
