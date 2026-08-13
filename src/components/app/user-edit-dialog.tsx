"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { Card, CardContent } from "@/components/core/ui/card";
import { Loader2, X, CheckCircle2 } from "lucide-react";
import type { UserEditDialogProps } from "@/lib/admin/types";

interface BriitelyUserOption {
  id: string;
  label: string;
}

export function UserEditDialog({ profile, isSuperAdmin, onClose, onSaved }: UserEditDialogProps) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [role, setRole] = useState(profile.role);
  const [ghlUserId, setGhlUserId] = useState("");
  const [isActive, setIsActive] = useState(profile.isActive);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
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

    if (confirmDeactivate && !isActive) {
      setConfirmDeactivate(false);
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/admin/users/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role,
          ghlUserId: ghlUserId || null,
          isActive,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "We couldn't save the changes. Please try again.");
        return;
      }

      setSuccess(true);
      setTimeout(() => onSaved(), 1500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleActiveToggle() {
    if (profile.isActive && !isActive) {
      setConfirmDeactivate(true);
    } else {
      setIsActive(!isActive);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Manage User</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="text-sm text-muted-foreground text-center">Changes saved successfully.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-firstName">First Name</Label>
                  <Input id="edit-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading || !profile.canEdit} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lastName">Last Name</Label>
                  <Input id="edit-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading || !profile.canEdit} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" value={profile.email} disabled className="bg-muted/50" />
              </div>

              {profile.canChangeRole && (
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Role</Label>
                  <select
                    id="edit-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as "super_admin" | "admin" | "staff")}
                    disabled={loading}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                    {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                  </select>
                </div>
              )}

              {isSuperAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="edit-ghl">Briitely User</Label>
                  <select
                    id="edit-ghl"
                    value={ghlUserId}
                    onChange={(e) => setGhlUserId(e.target.value)}
                    disabled={loading || !profile.canEdit || usersLoading}
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

              {profile.canToggleActive && (
                <div className="space-y-2">
                  <Label>Account Status</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant={isActive ? "secondary" : "destructive"}
                      size="sm"
                      onClick={handleActiveToggle}
                      disabled={loading}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {isActive ? "Click to deactivate" : "Click to reactivate"}
                    </span>
                  </div>
                </div>
              )}

              {confirmDeactivate && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 space-y-2">
                  <p className="text-sm text-destructive font-medium">Deactivate this user?</p>
                  <p className="text-xs text-muted-foreground">They will lose access immediately. Historical records remain unchanged.</p>
                  <div className="flex gap-2 pt-1">
                    <Button type="button" variant="destructive" size="sm" onClick={() => { setIsActive(false); setConfirmDeactivate(false); }}>
                      Yes, deactivate
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDeactivate(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
