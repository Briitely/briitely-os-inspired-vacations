"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { DetailGroup, DetailItem, WorkspaceSection } from "@/components/core/workspace-section";
import { formatPhoneNumber } from "@/lib/format/phone";

interface ProfileDetailsFormProps { firstName: string; lastName: string; phone: string; email: string; }

export function ProfileDetailsForm({ firstName: initialFirst, lastName: initialLast, phone: initialPhone, email }: ProfileDetailsFormProps) {
  const router = useRouter();
  const [saved, setSaved] = useState({ firstName: initialFirst, lastName: initialLast, phone: initialPhone });
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [phone, setPhone] = useState(initialPhone);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function toggleEditing() {
    if (editing) {
      setFirstName(saved.firstName);
      setLastName(saved.lastName);
      setPhone(saved.phone);
      setError(null);
    }
    setSuccess(false);
    setEditing(!editing);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "We couldn't save your profile. Please try again.");
        return;
      }
      setSaved({ firstName, lastName, phone });
      setEditing(false);
      setSuccess(true);
      router.refresh();
    } catch {
      setError("We couldn't save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <WorkspaceSection
      eyebrow="Profile"
      title="Your Details"
      description="Your name and phone number as your team sees them."
      action={<Button type="button" variant="outline" onClick={toggleEditing} disabled={loading}><Pencil className="h-4 w-4" />{editing ? "Cancel" : "Edit Your Details"}</Button>}
    >
      {!editing ? (
        <div className="space-y-4">
          <DetailGroup label="Name & Contact" columns={2}>
            <DetailItem label="First Name" value={saved.firstName} />
            <DetailItem label="Last Name" value={saved.lastName} />
            <DetailItem label="Phone" value={formatPhoneNumber(saved.phone)} />
            <DetailItem label="Sign-in Email" value={email} />
          </DetailGroup>
          <p className="text-xs text-muted-foreground">Your sign-in email also links you to your Briitely user. Ask an administrator if it needs to change.</p>
          {success && <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-green-600" />Profile saved.</p>}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-first-name">First name</Label>
              <Input id="profile-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading} required autoComplete="given-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-last-name">Last name</Label>
              <Input id="profile-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading} required autoComplete="family-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone</Label>
              <Input id="profile-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} autoComplete="tel" placeholder="(403) 555-0123" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Sign-in email</Label>
              <Input id="profile-email" value={email} disabled className="bg-muted/50" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Your sign-in email also links you to your Briitely user. Ask an administrator if it needs to change.</p>
          {error && <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3"><p className="text-sm text-destructive">{error}</p></div>}
          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Details</Button>
          </div>
        </form>
      )}
    </WorkspaceSection>
  );
}
