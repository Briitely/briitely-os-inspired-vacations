import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, CreditCard, Building2 } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
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
  return <div className="min-h-screen bg-background"><DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role} /><main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8"><div className="space-y-5"><Button variant="ghost" asChild className="-ml-3"><Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link></Button><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><CreditCard className="h-6 w-6" /></div><div><h1 className="text-3xl font-bold tracking-tight">Receive Payment</h1><p className="mt-2 text-base text-muted-foreground">Record a cheque or e-transfer against an unpaid invoice.</p></div></div></div><PaymentFlow initialCustomer={parseJsonParam(params.customer)} initialInvoice={parseJsonParam(params.invoice)} /></main><footer className="mt-16 border-t border-border"><div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8"><Building2 className="h-4 w-4" /><span>Briitely OS — Business Dashboard</span></div></footer></div>;
}
