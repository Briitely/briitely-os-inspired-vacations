import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { SharedFooter } from "@/components/app/shared-footer";
import { PaymentFlow } from "@/components/app/payment-flow";
import { Button } from "@/components/core/ui/button";
import Link from "next/link";

export const metadata: Metadata = { title: "Receive Payment — Briitely OS" };

function parseJsonParam<T>(value: string | undefined): T | null {
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ customer?: string; invoice?: string }> }) {
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) redirect("/login?redirect=/payments");
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
            <p className="eyebrow">Payments</p>
            <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Receive Payment</h1>
            <p className="mt-1 text-muted-foreground">Record a cheque or e-transfer against an unpaid invoice.</p>
          </div>
        </div>
        <PaymentFlow initialCustomer={parseJsonParam(params.customer)} initialInvoice={parseJsonParam(params.invoice)} />
      </main>
      <SharedFooter />
    </div>
  );
}
