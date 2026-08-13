import { createClient } from "@/lib/supabase/server";
import type { InvoiceCommission, UpsertInvoiceCommissionInput } from "./types";

export async function getInvoiceCommission(
  invoiceId: string
): Promise<InvoiceCommission | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice_commissions")
    .select("*")
    .eq("invoice_id", invoiceId)
    .maybeSingle();

  if (error) {
    console.error("GET_INVOICE_COMMISSION_FAILED", {
      invoiceId,
      message: error.message,
      code: error.code,
    });
    throw error;
  }

  return data as InvoiceCommission | null;
}

export async function getAllInvoiceCommissions(): Promise<InvoiceCommission[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice_commissions")
    .select("*");

  if (error) {
    console.error("GET_ALL_INVOICE_COMMISSIONS_FAILED", {
      message: error.message,
      code: error.code,
    });
    throw error;
  }

  return (data ?? []) as InvoiceCommission[];
}

export async function upsertInvoiceCommission(
  input: UpsertInvoiceCommissionInput
): Promise<InvoiceCommission> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice_commissions")
    .upsert(
      {
        invoice_id: input.invoiceId,
        invoice_number:
          input.invoiceNumber != null ? String(input.invoiceNumber) : null,
        contact_id: input.contactId,
        customer_name: input.customerName ?? null,
        assigned_user_id: input.assignedUserId ?? null,
        commission_sale: input.commissionSale,
      },
      { onConflict: "invoice_id" }
    )
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("UPSERT_INVOICE_COMMISSION_FAILED", {
      invoiceId: input.invoiceId,
      message: error.message,
      code: error.code,
    });
    throw error;
  }

  return data as InvoiceCommission;
}
