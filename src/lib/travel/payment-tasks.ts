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

export async function syncPaymentBatchTask(
  db: any,
  travelFileId: string,
  dueDate: string,
  assignedToOverride?: string | null
) {
  const [{ data: rows, error: rowsError }, { data: file }, { data: dana }] = await Promise.all([
    db
      .from("travel_payments")
      .select("payment_group_id,description,amount,currency,status,details,external_reference")
      .eq("travel_file_id", travelFileId)
      .eq("due_date", dueDate),
    db.from("travel_files").select("assigned_advisor_id").eq("id", travelFileId).maybeSingle(),
    db.from("profiles").select("id").ilike("full_name", "Dana%").eq("is_active", true).limit(1).maybeSingle(),
  ]);

  if (rowsError) {
    console.error("PAYMENT_BATCH_LOOKUP_FAILED", rowsError);
    return;
  }

  const groupIds = Array.from(new Set((rows ?? []).map((row: any) => row.payment_group_id).filter(Boolean)));
  const { data: groups } = groupIds.length
    ? await db.from("travel_payment_groups").select("id,label").in("id", groupIds)
    : { data: [] };
  const groupLabels = new Map((groups ?? []).map((group: any) => [group.id, clean(group.label) ?? "Booking Group"]));

  const upcoming = (rows ?? []).filter((row: any) => row.status !== "paid" && row.status !== "cancelled");
  const byGroup = new Map<string, any[]>();
  for (const row of upcoming) {
    const key = row.payment_group_id ?? "__ungrouped__";
    byGroup.set(key, [...(byGroup.get(key) ?? []), row]);
  }

  const dateLabel = formatDate(dueDate);
  if (upcoming.length === 0) {
    const { error: cleanupError } = await db.from("travel_file_tasks").delete().eq("travel_file_id", travelFileId).like("title", `${PAYMENT_TASK_PREFIX}${dateLabel}%`).neq("status", "complete");
    if (cleanupError) console.error("PAYMENT_EMPTY_BATCH_TASK_DELETE_FAILED", cleanupError);
    return;
  }
  const assignedTo = assignedToOverride ?? dana?.id ?? file?.assigned_advisor_id ?? null;
  const now = new Date().toISOString();
  const expectedTitles = new Set<string>();

  for (const [groupId, groupRows] of byGroup) {
    const groupLabel = groupId === "__ungrouped__" ? "No Booking Group" : groupLabels.get(groupId) ?? "Booking Group";
    const title = `${PAYMENT_TASK_PREFIX}${dateLabel} — ${groupLabel}`;
    expectedTitles.add(title);

    const totals = new Map<string, number>();
    const lines = groupRows.map((row: any) => {
      const details = parseDetails(row.details);
      if (row.amount != null) {
        const currency = row.currency || "CAD";
        totals.set(currency, (totals.get(currency) ?? 0) + Number(row.amount));
      }
      const action = details.processingMethod === "supplier_auto" ? "VERIFY supplier charge" : "PROCESS payment";
      const supplier = details.supplier ? ` — ${details.supplier}` : "";
      const confirmation = row.external_reference ? ` #${row.external_reference}` : "";
      const card = details.cardLastFour ? ` — card •••• ${details.cardLastFour}` : "";
      return `• ${action}: ${row.description}${supplier}${confirmation} — ${formatMoney(
        row.amount == null ? null : Number(row.amount),
        row.currency
      )}${card}`;
    });

    const totalText = Array.from(totals.entries())
      .map(([currency, amount]) => formatMoney(amount, currency))
      .join(" + ");
    const notes = [
      `${groupLabel} payment batch for ${dateLabel}${totalText ? ` — ${totalText}` : ""}`,
      "",
      ...lines,
    ].join("\n");

    const { data: matchingTasks } = await db
      .from("travel_file_tasks")
      .select("id,status,created_at")
      .eq("travel_file_id", travelFileId)
      .eq("title", title)
      .order("created_at", { ascending: true });
    const existing = matchingTasks?.[0] ?? null;
    const duplicateIds = (matchingTasks ?? []).slice(1).filter((task: any) => task.status !== "complete").map((task: any) => task.id);
    if (duplicateIds.length) {
      const { error: duplicateError } = await db.from("travel_file_tasks").delete().in("id", duplicateIds);
      if (duplicateError) console.error("PAYMENT_DUPLICATE_TASK_DELETE_FAILED", duplicateError);
    }

    if (existing) {
      const update: Record<string, unknown> = { notes, assigned_to: assignedTo, due_date: dueDate, updated_at: now };
      if (existing.status === "complete") {
        update.status = "todo";
        update.completed_at = null;
        update.completed_by = null;
      }
      const { error } = await db.from("travel_file_tasks").update(update).eq("id", existing.id);
      if (error) console.error("PAYMENT_BATCH_TASK_UPDATE_FAILED", error);
    } else {
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

  }

  // Remove obsolete, still-open automated tasks for this date (including the older ungrouped format).
  const { data: dateTasks } = await db
    .from("travel_file_tasks")
    .select("id,title,status")
    .eq("travel_file_id", travelFileId)
    .or(`title.eq.${PAYMENT_TASK_PREFIX}${dateLabel},title.like.${PAYMENT_TASK_PREFIX}${dateLabel} — %,title.like.Send payment reminder — %due on ${dateLabel}`);

  for (const task of dateTasks ?? []) {
    if (task.status === "complete") continue;
    const isPaymentTask = task.title.startsWith(PAYMENT_TASK_PREFIX);
    const keep = isPaymentTask && expectedTitles.has(task.title);
    if (!keep) {
      const { error } = await db.from("travel_file_tasks").delete().eq("id", task.id);
      if (error) console.error("PAYMENT_OBSOLETE_TASK_DELETE_FAILED", error);
    }
  }
}
