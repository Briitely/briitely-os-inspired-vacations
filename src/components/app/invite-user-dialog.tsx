"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { Card, CardContent } from "@/components/core/ui/card";
import { Loader2, X, CheckCircle2, Mail } from "lucide-react";
import type { InviteUserDialogProps } from "@/lib/admin/types";

interface BriitelyUserOption {
  id: string;
  label: string;
}

export function InviteUserDialog({ isSuperAdmin, onClose, onInvited }: InviteUserDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "staff" | "super_admin">("staff");
  const [ghlUserId, setGhlUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [briitelyUsers, setBriitelyUsers] = useState<BriitelyUserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersFallback, setUsersFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/briitely/users")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.users) setBriitelyUsers(data.users);
        if (data.fallback) setUsersFallback(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

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
          ghlUserId: ghlUserId || null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Invite User</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-5 w-5" />
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
              {isSuperAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="invite-ghl">Briitely User</Label>
                  <select
                    id="invite-ghl"
                    value={ghlUserId}
                    onChange={(e) => setGhlUserId(e.target.value)}
                    disabled={loading || usersLoading}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Not mapped</option>
                    {briitelyUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.label}</option>
                    ))}
                  </select>
                  {usersFallback && (
                    <p className="text-xs text-muted-foreground">Briitely users couldn&apos;t be loaded.</p>
                  )}
                </div>
              )}

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
