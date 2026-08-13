import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { listCustomerInvoices, listAllCustomerInvoices } from "@/lib/briitely/payments";
import { BriitelyApiError } from "@/lib/briitely/errors";
import { filterInvoicesByGoLiveDate } from "@/lib/briitely/invoice-cutoff";
import { clientConfig } from "@/config/client.config";

export async function GET(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const { user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "You must be signed in to view invoices." }, { status: 401 });
  try {
    const { customerId } = await params;
    const url = new URL(request.url);
    const history = url.searchParams.get("history") === "true";

    if (history) {
      const invoices = await listAllCustomerInvoices(customerId, 10);
      return NextResponse.json({ invoices: filterInvoicesByGoLiveDate(invoices, clientConfig.invoiceGoLiveDate) });
    }

    const invoices = await listCustomerInvoices(customerId);
    return NextResponse.json({ invoices: filterInvoicesByGoLiveDate(invoices, clientConfig.invoiceGoLiveDate) });
  } catch (error) {
    const apiError = error instanceof BriitelyApiError ? error : null;
    return NextResponse.json({ error: apiError?.status && apiError.status < 500 ? apiError.message : "We couldn't load this customer's invoices." }, { status: apiError?.status && apiError.status >= 400 && apiError.status < 500 ? apiError.status : 502 });
  }
}
