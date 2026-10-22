"use client";

import { useState } from "react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { Card, CardContent } from "@/components/core/ui/card";
import { Loader2, X, CheckCircle2, Mail } from "lucide-react";
import type { InviteUserDialogProps } from "@/lib/admin/types";

export function InviteUserDialog({ isSuperAdmin, onClose, onInvited }: InviteUserDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "staff" | "super_admin">("staff");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) { setError("First name is required."); return; }
    if (!lastName.trim()) { setError("Last name is required."); return; }
    if (!email.trim()) { setError("Email is required."); return; }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "We couldn't send the invitation. Please try again.");
        return;
      }

      setSuccess(true);
      setTimeout(() => onInvited(), 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-24" onClick={onClose}>
      <Card className="w-full max-w-md rounded-xl border-0 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-primary">User access</p>
              <h3 className="mt-1 text-xl font-semibold text-foreground">Invite User</h3>
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="text-sm text-muted-foreground text-center">
                Invitation sent to {email.trim()}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="invite-firstName">First Name</Label>
                  <Input id="invite-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={loading} autoFocus />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-lastName">Last Name</Label>
                  <Input id="invite-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={loading} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "admin" | "staff" | "super_admin")}
                  disabled={loading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                </select>
              </div>
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending invitation...</>
                ) : (
                  <><Mail className="mr-2 h-4 w-4" />Send Invitation</>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
