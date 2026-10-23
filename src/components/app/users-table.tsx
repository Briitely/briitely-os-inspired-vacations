"use client";
import { useState } from "react";
import { UsersTableProps } from "@/lib/admin/types";
import { InviteUserDialog } from "@/components/app/invite-user-dialog";
import { UserEditDialog } from "@/components/app/user-edit-dialog";
import { Badge } from "@/components/core/ui/badge";
import { Button } from "@/components/core/ui/button";
import { WorkspaceSection } from "@/components/core/workspace-section";
import { Loader2, Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/core/ui/os-dialog";
import { rowAction } from "@/components/core/ui/row-action";

type Profile = UsersTableProps["profiles"][number];

// Row actions in lists are compact text buttons, no icons (same as High Q).

function roleLabel(role: string) { return role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : "Staff"; }

function statusBadge(status: string) {
  if (status === "active") return <Badge className="w-fit">Active</Badge>;
  if (status === "pending") return <Badge variant="outline" className="w-fit">Invited</Badge>;
  return <Badge variant="secondary" className="w-fit">Inactive</Badge>;
}

function lastSignIn(value: string | null | undefined) {
  if (!value) return "Never signed in";
  return `Last signed in ${new Date(value).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}`;
}

/** Team members as a standard split section: Invite User on the left, one row per person on the right. */
export function UsersTable({ profiles, isSuperAdmin }: UsersTableProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<UsersTableProps["profiles"][number] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function act(id: string, url: string, init: RequestInit, done: (d: { message?: string; error?: string }) => string, failed: string, reload = false) {
    setBusyId(id); setMessage(null);
    try {
      const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMessage(d.error || failed); return; }
      setMessage(done(d));
      if (reload) window.location.reload();
    } catch { setMessage(failed); }
    finally { setBusyId(null); }
  }
  const resend = (p: Profile) => act(p.id, "/api/admin/users/invite/resend", { method: "POST", body: JSON.stringify({ email: p.email }) }, () => `Invitation resent to ${p.email}.`, "We couldn't resend the invitation.");
  const reset = (p: Profile) => act(p.id, `/api/admin/users/${p.id}/send-password-reset`, { method: "POST" }, (d) => d.message || `Password reset email sent to ${p.email}.`, "We couldn't send the password reset.");
  const [confirming, setConfirming] = useState<Profile | null>(null);
  const toggle = async (p: Profile) => {
    const verb = p.isActive ? "deactivate" : "reactivate";
    await act(p.id, `/api/admin/users/${p.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !p.isActive }) }, () => "", `We couldn't ${verb} that user.`, true);
    setConfirming(null);
  };

  return <>
    <WorkspaceSection
      eyebrow="Team"
      title="Team Members"
      description="Invite people and manage their access. Invited people haven't signed in yet. Each person links to Briitely automatically when a Briitely user has the same email."
      action={<Button variant="outline" onClick={() => setInviteOpen(true)}><Plus className="h-4 w-4" />Invite User</Button>}
    >
      {message && <p className="mb-3 text-sm text-muted-foreground">{message}</p>}
      <div className="divide-y divide-border">
        {profiles.map((p) => (
          <div key={p.id} className="grid items-center gap-x-4 gap-y-2 py-4 first:pt-0 sm:grid-cols-[40px_minmax(180px,1fr)_76px_90px_auto]">
            <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background sm:flex">{(p.fullName || p.email || "U").charAt(0).toUpperCase()}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{p.fullName || "—"}{p.isSelf && <span className="ml-2 text-xs font-normal text-muted-foreground">(You)</span>}</p>
              <p className="truncate text-xs text-muted-foreground">{p.email}</p>
              <p className="text-xs text-muted-foreground">
                {p.status === "inactive" ? "Inactive" : lastSignIn(p.lastSignInAt)}
                {" · "}
                {p.ghlUserId ? <span>Briitely: {p.ghlLabel}</span> : <span className="font-medium text-destructive" title="Add a Briitely user with this email, then reload this page.">Not linked to Briitely</span>}
              </p>
            </div>
            <div>{statusBadge(p.status)}</div>
            <div className="text-xs font-semibold text-muted-foreground">{roleLabel(p.role)}</div>
            <div className="flex flex-wrap justify-start gap-1 sm:justify-end">
              {busyId === p.id && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />}
              {p.canEdit ? <button type="button" className={rowAction} onClick={() => setEditProfile(p)} disabled={busyId === p.id}>Edit User</button> : <span className="px-2 text-xs text-muted-foreground">Protected</span>}
              {p.canResendInvite && <button type="button" className={rowAction} onClick={() => void resend(p)} disabled={busyId === p.id}>Resend Invitation</button>}
              {p.canEdit && !p.isSelf && p.status === "active" && <button type="button" className={rowAction} onClick={() => void reset(p)} disabled={busyId === p.id}>Send Password Reset</button>}
              {p.canToggleActive && <button type="button" className={`${rowAction} ${p.isActive ? "text-destructive" : ""}`} onClick={() => setConfirming(p)} disabled={busyId === p.id}>{p.isActive ? "Deactivate" : "Reactivate"}</button>}
            </div>
          </div>
        ))}
      </div>
    </WorkspaceSection>
    <ConfirmDialog
      open={Boolean(confirming)}
      eyebrow="User access"
      title={confirming?.isActive ? "Deactivate User" : "Reactivate User"}
      message={confirming?.isActive ? <>Deactivate <strong className="text-foreground">{confirming?.fullName || confirming?.email}</strong>? They won&apos;t be able to sign in until they&apos;re reactivated.</> : <>Reactivate <strong className="text-foreground">{confirming?.fullName || confirming?.email}</strong>? They&apos;ll be able to sign in again.</>}
      confirmLabel={confirming?.isActive ? "Deactivate" : "Reactivate"}
      tone={confirming?.isActive ? "danger" : "default"}
      busy={Boolean(confirming && busyId === confirming.id)}
      onConfirm={() => { if (confirming) void toggle(confirming); }}
      onCancel={() => setConfirming(null)}
    />
    {inviteOpen && <InviteUserDialog isSuperAdmin={isSuperAdmin} onClose={() => setInviteOpen(false)} onInvited={() => { setInviteOpen(false); window.location.reload(); }} />}
    {editProfile && <UserEditDialog profile={editProfile} isSuperAdmin={isSuperAdmin} onClose={() => setEditProfile(null)} onSaved={() => { setEditProfile(null); window.location.reload(); }} />}
  </>;
}
