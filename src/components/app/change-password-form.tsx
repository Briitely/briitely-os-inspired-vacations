"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { DetailGroup, DetailItem, WorkspaceSection } from "@/components/core/workspace-section";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [editing, setEditing] = useState(false);

  function toggleEditing() {
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
    setEditing(!editing);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("We couldn't update your password. Please try again.");
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setEditing(false);
      setSuccess(true);
    } catch {
      setError("We couldn't update your password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <WorkspaceSection
      eyebrow="Security"
      title="Password"
      description="Change the password you use to sign in."
      action={<Button type="button" variant="outline" onClick={toggleEditing} disabled={loading}><KeyRound className="h-4 w-4" />{editing ? "Cancel" : "Change Password"}</Button>}
    >
      {!editing ? (
        <div className="space-y-4">
          <DetailGroup label="Sign-in" columns={2}>
            <DetailItem label="Password" value="••••••••" />
          </DetailGroup>
          {success && <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-green-600" />Password updated.</p>}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <Input id="confirm-new-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={loading} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={loading || !password || !confirmPassword}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Updating...</> : "Update Password"}
            </Button>
          </div>
        </form>
      )}
    </WorkspaceSection>
  );
}
