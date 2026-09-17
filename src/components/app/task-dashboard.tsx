"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Check, History, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";

type Profile = { id: string; full_name: string };
type File = { id: string; client_name: string; destination: string | null; departure_date: string | null; stage: string };
type Task = { id: string; title: string; notes: string | null; assigned_to: string | null; due_date: string | null; status: string; completed_at: string | null; travel_file_id: string | null; assigned_profile: Profile | null; travel_file: File | null };
type DueSort = "priority" | "oldest" | "newest";
type View = "mine" | "team" | "completed";

export function TaskDashboard() {
  const [view, setView] = useState<View>("mine");
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [me, setMe] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [assigned, setAssigned] = useState("");
  const [due, setDue] = useState("");
  const [fileId, setFileId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dueSort, setDueSort] = useState<DueSort>("priority");

  async function load() {
    setLoading(true);
    setError(null);
    const scope = view === "mine" ? "mine" : "team";
    const status = view === "completed" ? "complete" : "open";
    const response = await fetch(`/api/tasks?scope=${scope}&status=${status}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) {
      setTasks(data.tasks ?? []);
      setProfiles(data.profiles ?? []);
      setFiles(data.travelFiles ?? []);
      setMe(data.currentUserId ?? "");
      if (!assigned) setAssigned(data.currentUserId ?? "");
    } else {
      setError(data.error ?? "Could not load tasks.");
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [view]);

  async function add() {
    if (!title.trim()) return;
    setSaving(true);
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, notes, assignedTo: assigned || me, dueDate: due || null, travelFileId: fileId || null }),
    });
    const data = await response.json();
    if (response.ok) {
      setTitle("");
      setNotes("");
      setDue("");
      setFileId("");
      setAssigned(me);
      setAdding(false);
      await load();
    } else {
      setError(data.error ?? "Could not add task.");
    }
    setSaving(false);
  }

  async function patch(taskId: string, updates: Record<string, unknown>) {
    setSaving(true);
    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, ...updates }),
    });
    if (response.ok) {
      await load();
    } else {
      const data = await response.json();
      setError(data.error ?? "Could not update task.");
    }
    setSaving(false);
  }

  async function remove(taskId: string) {
    if (!window.confirm("Delete this task?")) return;
    setSaving(true);
    const response = await fetch("/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    if (response.ok) {
      await load();
    } else {
      const data = await response.json();
      setError(data.error ?? "Could not delete task.");
    }
    setSaving(false);
  }

  const overdue = (value: string | null) => Boolean(value && new Date(`${value}T23:59:59`).getTime() < Date.now());
  const label = (file: File) => `${file.client_name}${file.destination ? ` — ${file.destination}` : ""}`;
  const visibleTasks = advisorFilter ? tasks.filter((task) => task.assigned_to === advisorFilter) : tasks;
  const sortedTasks = useMemo(() => view === "completed" ? visibleTasks : [...visibleTasks].sort((a, b) => {
    const aDue = a.due_date ? new Date(`${a.due_date}T00:00:00`).getTime() : null;
    const bDue = b.due_date ? new Date(`${b.due_date}T00:00:00`).getTime() : null;
    if (dueSort === "priority") {
      if (aDue !== null && bDue === null) return -1;
      if (aDue === null && bDue !== null) return 1;
      if (aDue !== null && bDue !== null) return aDue - bDue;
      return 0;
    }
    const av = aDue ?? (dueSort === "oldest" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
    const bv = bDue ?? (dueSort === "oldest" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
    return dueSort === "oldest" ? av - bv : bv - av;
  }), [visibleTasks, dueSort, view]);

  const cycleDueSort = () => setDueSort((value) => value === "priority" ? "oldest" : value === "oldest" ? "newest" : "priority");
  const dueIcon = dueSort === "oldest" ? <ArrowUp className="h-3.5 w-3.5" /> : dueSort === "newest" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5" />;
  const dueTitle = dueSort === "priority" ? "Priority: earliest due dates first, then tasks without due dates" : dueSort === "oldest" ? "Oldest due date first" : "Newest due date first";
  const emptyMessage = advisorFilter ? `This advisor has no ${view === "completed" ? "completed" : "open"} tasks.` : view === "mine" ? "You have no open tasks." : view === "completed" ? "There are no completed team tasks." : "There are no open team tasks.";

  return <div className="space-y-4">
    <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={view === "mine" && !advisorFilter ? "default" : "outline"} onClick={() => { setAdvisorFilter(""); setView("mine"); }}>My Tasks</Button>
        <Button variant={view === "team" && !advisorFilter ? "default" : "outline"} onClick={() => { setAdvisorFilter(""); setView("team"); }}>Team Tasks</Button>
        <Button variant={view === "completed" && !advisorFilter ? "default" : "outline"} onClick={() => { setAdvisorFilter(""); setView("completed"); }}><History className="h-4 w-4" />Completed Tasks</Button>
        <select
          className={`h-10 min-w-44 rounded-md border px-3 text-sm ${advisorFilter ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
          value={advisorFilter}
          onChange={(event) => {
            setAdvisorFilter(event.target.value);
            if (event.target.value && view === "mine") setView("team");
          }}
          aria-label="Filter tasks by advisor"
        >
          <option value="">Advisor</option>
          {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
        </select>
      </div>
      {view !== "completed" && <Button onClick={() => setAdding((value) => !value)}><Plus className="h-4 w-4" />Add Task</Button>}
    </div>

    {adding && view !== "completed" && <div className="space-y-3 rounded-xl border bg-card p-5">
      <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Task</label><Input autoFocus placeholder="What needs to be done?" value={title} onChange={(event) => setTitle(event.target.value)} /></div>
      <div className="grid gap-3 md:grid-cols-3">
        <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned To</label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={assigned} onChange={(event) => setAssigned(event.target.value)}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></div>
        <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due Date</label><Input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></div>
        <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Travel File <span className="font-normal normal-case">(optional)</span></label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={fileId} onChange={(event) => setFileId(event.target.value)}><option value="">General task — no Travel File</option>{files.map((file) => <option key={file.id} value={file.id}>{label(file)}</option>)}</select></div>
      </div>
      <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes <span className="font-normal normal-case">(optional)</span></label><textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Details, links, context, etc." /></div>
      <div className="flex gap-2"><Button disabled={saving || !title.trim()} onClick={() => void add()}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save Task</Button><Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button></div>
    </div>}

    {loading ? <div className="flex items-center gap-2 rounded-xl border bg-card p-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading tasks…</div> : error ? <p className="text-sm text-destructive">{error}</p> : visibleTasks.length === 0 ? <div className="rounded-xl border bg-card p-6 text-sm italic text-muted-foreground">{emptyMessage}</div> : <div className="overflow-hidden rounded-xl border bg-card">
      <div className="hidden grid-cols-[minmax(0,1fr)_180px_155px_230px_100px] gap-3 border-b bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid"><span>Task</span><span>Assigned To</span>{view === "completed" ? <span>Completed</span> : <button type="button" title={dueTitle} onClick={cycleDueSort} className="inline-flex items-center gap-1 text-left hover:text-foreground">Due {dueIcon}</button>}<span>Related To</span><span>Actions</span></div>
      {sortedTasks.map((task) => {
        const isCompleted = view === "completed";
        const isOverdue = !isCompleted && overdue(task.due_date);
        return <div key={task.id} className={`grid gap-3 border-b px-4 py-3 last:border-0 lg:grid-cols-[minmax(0,1fr)_180px_155px_230px_100px] lg:items-center ${isOverdue ? "bg-red-50/70" : ""}`}>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {task.travel_file_id ? <Link href={`/travel-files/${task.travel_file_id}`} className={`text-sm font-medium hover:underline ${isOverdue ? "text-red-700" : isCompleted ? "text-muted-foreground" : "text-primary"}`}>{task.title}</Link> : <p className={`text-sm font-medium ${isOverdue ? "text-red-700" : isCompleted ? "text-muted-foreground" : ""}`}>{task.title}</p>}
              {isOverdue && <span className="inline-flex rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">Overdue</span>}
            </div>
            {task.notes && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.notes}</p>}
          </div>
          {isCompleted ? <span className="text-sm text-muted-foreground">{task.assigned_profile?.full_name ?? "Unassigned"}</span> : <select disabled={saving} className="h-9 rounded-md border bg-background px-2 text-sm" value={task.assigned_to ?? ""} onChange={(event) => void patch(task.id, { assignedTo: event.target.value || null })}><option value="">Unassigned</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select>}
          {isCompleted ? <span className="text-sm text-muted-foreground">{task.completed_at ? new Date(task.completed_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span> : <div className={isOverdue ? "text-destructive" : ""}><Input disabled={saving} type="date" value={task.due_date ?? ""} onChange={(event) => void patch(task.id, { dueDate: event.target.value || null })} /></div>}
          {isCompleted ? <span className="text-xs text-muted-foreground">{task.travel_file ? label(task.travel_file) : "General — no Travel File"}</span> : <select disabled={saving} className="h-9 w-full rounded-md border bg-background px-2 text-xs" value={task.travel_file_id ?? ""} onChange={(event) => void patch(task.id, { travelFileId: event.target.value || null })}><option value="">General — no Travel File</option>{task.travel_file && !files.some((file) => file.id === task.travel_file_id) && <option value={task.travel_file.id}>{label(task.travel_file)}</option>}{files.map((file) => <option key={file.id} value={file.id}>{label(file)}</option>)}</select>}
          <div className="flex items-center gap-1">{isCompleted ? <Button size="sm" variant="outline" title="Reactivate task" disabled={saving} onClick={() => void patch(task.id, { status: "todo" })}><RotateCcw className="h-4 w-4" />Reactivate</Button> : <><Button size="icon" variant="ghost" title="Complete task" disabled={saving} onClick={() => void patch(task.id, { status: "complete" })}><Check className="h-4 w-4" /></Button><Button size="icon" variant="ghost" title="Delete task" disabled={saving} onClick={() => void remove(task.id)}><Trash2 className="h-4 w-4" /></Button></>}</div>
        </div>;
      })}
    </div>}
    {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
  </div>;
}
