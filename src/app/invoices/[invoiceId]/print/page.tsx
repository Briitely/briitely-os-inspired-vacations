import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getInvoice } from "@/lib/briitely/invoice-details";
import { InvoicePrintView } from "@/components/core/invoice-print-view";
import { getBusinessSettings } from "@/lib/briitely/client-settings";

export default async function InvoicePrintPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { user } = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const { invoiceId } = await params;
  const [invoice, business] = await Promise.all([
    getInvoice(invoiceId),
    getBusinessSettings(),
  ]);
  return <InvoicePrintView invoice={invoice} businessSettings={business} />;
}
