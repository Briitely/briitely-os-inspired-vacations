"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";

type Profile = { id: string; full_name: string };
type Task = {
  id: string;
  title: string;
  notes: string | null;
  assigned_to: string | null;
  due_date: string | null;
  status: "todo" | "in_progress" | "complete";
  completed_at: string | null;
  assigned_profile: Profile | null;
  completed_profile: Profile | null;
};

type Payment = {
  id: string;
  payment_type: string;
  description: string | null;
  supplier?: string | null;
  confirmation_number?: string | null;
  amount: number | null;
  currency: string | null;
  due_date: string | null;
  status: string | null;
  processed_at: string | null;
  card_last_four?: string | null;
  processing_method?: string | null;
};

function isPaymentBatchTask(task: Task) {
  return task.title.startsWith("Payments due — ") && Boolean(task.due_date);
}

function money(value: number | null, currency: string | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  }).format(value);
}

export function TravelFileTasks({
  travelFileId,
  canEdit,
}: {
  travelFileId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState("");
  const [assigned, setAssigned] = useState("");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [taskResponse, paymentResponse] = await Promise.all([
        fetch(`/api/travel-files/${travelFileId}/tasks`, { cache: "no-store" }),
        fetch(`/api/travel-files/${travelFileId}/payments`, { cache: "no-store" }),
      ]);
      const taskData = await taskResponse.json();
      const paymentData = await paymentResponse.json();
      if (!taskResponse.ok) throw new Error(taskData.error ?? "Could not load tasks.");
      setTasks(taskData.tasks ?? []);
      setProfiles(taskData.profiles ?? []);
      setPayments(paymentResponse.ok ? paymentData.payments ?? [] : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [travelFileId]);

  async function add() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const response = await fetch(`/api/travel-files/${travelFileId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, assignedTo: assigned || null, dueDate: due || null, notes }),
    });
    const data = await response.json();
    if (response.ok) {
      setTitle("");
      setAssigned("");
      setDue("");
      setNotes("");
      setAdding(false);
      await load();
      router.refresh();
    } else {
      setError(data.error ?? "Could not add task.");
    }
    setSaving(false);
  }

  async function patch(id: string, updates: Record<string, unknown>) {
    setSaving(true);
    const response = await fetch(`/api/travel-files/${travelFileId}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: id, ...updates }),
    });
    if (response.ok) {
      await load();
      router.refresh();
    } else {
      const data = await response.json();
      setError(data.error ?? "Could not update task.");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this task?")) return;
    setSaving(true);
    await fetch(`/api/travel-files/${travelFileId}/tasks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: id }),
    });
    await load();
    setSaving(false);
  }

  async function markPaymentPaid(payment: Payment) {
    if (!canEdit || saving || payment.status === "paid" || !payment.due_date) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/travel-files/${travelFileId}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          paymentType: payment.payment_type,
          description: payment.description,
          supplier: payment.supplier,
          confirmationNumber: payment.confirmation_number,
          amount: payment.amount,
          currency: payment.currency,
          dueDate: payment.due_date,
          status: "paid",
          processedDate: new Date().toISOString().slice(0, 10),
          cardLastFour: payment.card_last_four,
          processingMethod: payment.processing_method ?? "manual",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not mark payment as paid.");
      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark payment as paid.");
    } finally {
      setSaving(false);
    }
  }

  const open = tasks.filter((task) => task.status !== "complete");
  const done = tasks.filter((task) => task.status === "complete");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Tasks</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Operational to-dos for this Travel File</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setAdding((value) => !value)}>
            <Plus className="h-4 w-4" /> Add Task
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <Input placeholder="What needs to be done?" value={title} onChange={(event) => setTitle(event.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={assigned} onChange={(event) => setAssigned(event.target.value)}>
                <option value="">Unassigned</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.full_name}</option>
                ))}
              </select>
              <Input type="date" value={due} onChange={(event) => setDue(event.target.value)} />
            </div>
            <textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Notes or details (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" onClick={add} disabled={saving || !title.trim()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Task
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
          </div>
        ) : open.length === 0 && done.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No tasks for this Travel File.</p>
        ) : (
          <div className="space-y-2">
            {open.map((task) => {
              const paymentBatch = isPaymentBatchTask(task);
              const batchPayments = paymentBatch
                ? payments.filter((payment) => payment.due_date === task.due_date)
                : [];
              const pendingPayments = batchPayments.filter((payment) => payment.status !== "paid");
              const isExpanded = expanded[task.id] ?? false;

              return (
                <div key={task.id} className="rounded-lg border">
                  <div className="grid gap-3 p-3 sm:grid-cols-[auto_minmax(0,1fr)_160px_140px_auto] sm:items-center">
                    {paymentBatch ? (
                      <button
                        type="button"
                        onClick={() => setExpanded((current) => ({ ...current, [task.id]: !isExpanded }))}
                        className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
                        aria-label={isExpanded ? "Collapse payment list" : "Expand payment list"}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    ) : (
                      <button disabled={!canEdit || saving} onClick={() => patch(task.id, { status: "complete" })} className="h-5 w-5 rounded border" aria-label="Complete task" />
                    )}

                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      {paymentBatch ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {pendingPayments.length} payment{pendingPayments.length === 1 ? "" : "s"} remaining
                          {batchPayments.length > pendingPayments.length ? ` · ${batchPayments.length - pendingPayments.length} completed` : ""}
                        </p>
                      ) : task.notes ? (
                        <p className="mt-1 text-xs text-muted-foreground">{task.notes}</p>
                      ) : null}
                    </div>

                    <select disabled={!canEdit || saving} className="h-9 rounded-md border bg-background px-2 text-sm" value={task.assigned_to ?? ""} onChange={(event) => patch(task.id, { assignedTo: event.target.value || null })}>
                      <option value="">Unassigned</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>{profile.full_name}</option>
                      ))}
                    </select>

                    <Input
                      disabled={!canEdit || saving || paymentBatch}
                      type="date"
                      value={task.due_date ?? ""}
                      onChange={(event) => patch(task.id, { dueDate: event.target.value || null })}
                      title={paymentBatch ? "Payment batch due date comes from the payment records." : undefined}
                    />

                    {canEdit && (
                      <Button size="icon" variant="ghost" onClick={() => remove(task.id)} disabled={saving}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {paymentBatch && isExpanded && (
                    <div className="border-t bg-muted/10 px-4 py-3">
                      {batchPayments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No payments found for this date.</p>
                      ) : (
                        <div className="space-y-2">
                          {batchPayments.map((payment) => {
                            const paid = payment.status === "paid";
                            const autoCharge = payment.processing_method === "supplier_auto";
                            return (
                              <div key={payment.id} className={`grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-[auto_minmax(0,1fr)_120px] sm:items-center ${paid ? "opacity-60" : ""}`}>
                                <button
                                  type="button"
                                  disabled={!canEdit || saving || paid}
                                  onClick={() => void markPaymentPaid(payment)}
                                  className={`flex h-5 w-5 items-center justify-center rounded border ${paid ? "bg-muted" : ""}`}
                                  aria-label={paid ? "Payment completed" : "Mark payment paid"}
                                >
                                  {paid && <Check className="h-3.5 w-3.5" />}
                                </button>
                                <div>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className={`text-sm font-medium ${paid ? "line-through" : ""}`}>{payment.description || payment.payment_type}</span>
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      {autoCharge ? "Verify supplier charge" : "Process payment"}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                                    {payment.supplier && <span>{payment.supplier}</span>}
                                    {payment.confirmation_number && <span>#{payment.confirmation_number}</span>}
                                    {payment.card_last_four && <span>Card •••• {payment.card_last_four}</span>}
                                    {paid && payment.processed_at && <span>Paid {new Date(payment.processed_at).toLocaleDateString("en-CA")}</span>}
                                  </div>
                                </div>
                                <div className="text-sm font-semibold sm:text-right">{money(payment.amount, payment.currency)}</div>
                              </div>
                            );
                          })}
                          <p className="pt-1 text-xs text-muted-foreground">This task completes automatically when every payment in the batch is marked paid.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {done.length > 0 && (
              <details className="pt-2">
                <summary className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <ChevronDown className="h-4 w-4" />
                  {done.length} completed task{done.length === 1 ? "" : "s"}
                </summary>
                <div className="mt-2 space-y-2">
                  {done.map((task) => (
                    <div key={task.id} className="flex items-start gap-3 rounded-lg border px-3 py-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4" />
                      <div className="flex-1">
                        <p className="line-through">{task.title}</p>
                        <p className="text-xs">
                          Completed{task.completed_profile?.full_name ? ` by ${task.completed_profile.full_name}` : ""}
                          {task.completed_at ? ` · ${new Date(task.completed_at).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                      {canEdit && <Button size="sm" variant="ghost" onClick={() => patch(task.id, { status: "todo" })}>Reopen</Button>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
