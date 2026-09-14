import "server-only";

const PAYMENT_TASK_PREFIX = "Payments due — ";

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseDetails(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return { supplier: null, cardLastFour: null, processingMethod: "manual" };
  }
  try {
    const parsed = JSON.parse(value) as {
      supplier?: unknown;
      cardLastFour?: unknown;
      processingMethod?: unknown;
    };
    return {
      supplier: clean(parsed.supplier),
      cardLastFour: clean(parsed.cardLastFour),
      processingMethod: clean(parsed.processingMethod) === "supplier_auto" ? "supplier_auto" : "manual",
    };
  } catch {
    return { supplier: null, cardLastFour: null, processingMethod: "manual" };
  }
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatMoney(amount: number | null, currency: string | null) {
  if (amount == null) return "Amount not entered";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  }).format(amount);
}

export async function syncPaymentBatchTask(db: any, travelFileId: string, dueDate: string) {
  const [{ data: rows, error: rowsError }, { data: file }, { data: dana }] = await Promise.all([
    db
      .from("travel_payments")
      .select("description,amount,currency,status,details,external_reference")
      .eq("travel_file_id", travelFileId)
      .eq("due_date", dueDate),
    db
      .from("travel_files")
      .select("assigned_advisor_id")
      .eq("id", travelFileId)
      .maybeSingle(),
    db
      .from("profiles")
      .select("id")
      .ilike("full_name", "Dana%")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
  ]);

  if (rowsError) {
    console.error("PAYMENT_BATCH_LOOKUP_FAILED", rowsError);
    return;
  }

  const title = `${PAYMENT_TASK_PREFIX}${formatDate(dueDate)}`;
  const { data: existing, error: taskLookupError } = await db
    .from("travel_file_tasks")
    .select("id,status")
    .eq("travel_file_id", travelFileId)
    .eq("title", title)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (taskLookupError) {
    console.error("PAYMENT_BATCH_TASK_LOOKUP_FAILED", taskLookupError);
    return;
  }

  const upcoming = (rows ?? []).filter((row: any) => row.status !== "paid" && row.status !== "cancelled");
  if (!upcoming.length) {
    if (existing && existing.status !== "complete") {
      const now = new Date().toISOString();
      const { error } = await db
        .from("travel_file_tasks")
        .update({ status: "complete", completed_at: now, updated_at: now })
        .eq("id", existing.id);
      if (error) console.error("PAYMENT_BATCH_TASK_COMPLETE_FAILED", error);
    }
    return;
  }

  const totals = new Map<string, number>();
  const lines = upcoming.map((row: any) => {
    const details = parseDetails(row.details);
    if (row.amount != null) {
      const currency = row.currency || "CAD";
      totals.set(currency, (totals.get(currency) ?? 0) + Number(row.amount));
    }
    const action = details.processingMethod === "supplier_auto" ? "VERIFY supplier charge" : "PROCESS payment";
    const supplier = details.supplier ? ` — ${details.supplier}` : "";
    const confirmation = row.external_reference ? ` #${row.external_reference}` : "";
    const card = details.cardLastFour ? ` — card •••• ${details.cardLastFour}` : "";
    return `• ${action}: ${row.description}${supplier}${confirmation} — ${formatMoney(row.amount == null ? null : Number(row.amount), row.currency)}${card}`;
  });

  const totalText = Array.from(totals.entries())
    .map(([currency, amount]) => formatMoney(amount, currency))
    .join(" + ");
  const notes = [`Payment batch for ${formatDate(dueDate)}${totalText ? ` — ${totalText}` : ""}`, "", ...lines].join("\n");
  const assignedTo = dana?.id ?? file?.assigned_advisor_id ?? null;
  const now = new Date().toISOString();

  if (existing) {
    const update: Record<string, unknown> = {
      notes,
      assigned_to: assignedTo,
      due_date: dueDate,
      updated_at: now,
    };
    if (existing.status === "complete") {
      update.status = "todo";
      update.completed_at = null;
      update.completed_by = null;
    }
    const { error } = await db.from("travel_file_tasks").update(update).eq("id", existing.id);
    if (error) console.error("PAYMENT_BATCH_TASK_UPDATE_FAILED", error);
    return;
  }

  const { error } = await db.from("travel_file_tasks").insert({
    travel_file_id: travelFileId,
    title,
    notes,
    assigned_to: assignedTo,
    due_date: dueDate,
    status: "todo",
    task_context: "travel_file",
    created_by: null,
  });
  if (error) console.error("PAYMENT_BATCH_TASK_CREATE_FAILED", error);
}
