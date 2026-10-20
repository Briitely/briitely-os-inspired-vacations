"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";

interface ProfileDetailsFormProps { firstName: string; lastName: string; phone: string; email: string; }

export function ProfileDetailsForm({ firstName: initialFirst, lastName: initialLast, phone: initialPhone, email }: ProfileDetailsFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
      setSuccess(true);
      router.refresh();
    } catch {
      setError("We couldn't save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Your Details</CardTitle></CardHeader>
      <CardContent>
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">Phone</Label>
            <Input id="profile-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} autoComplete="tel" placeholder="(403) 555-0123" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Sign-in email</Label>
            <Input id="profile-email" value={email} disabled className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">Your sign-in email also links you to your Briitely user. Ask an administrator if it needs to change.</p>
          </div>
          {error && <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3"><p className="text-sm text-destructive">{error}</p></div>}
          {success && <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-green-600" />Profile saved.</p>}
          <Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Details</Button>
        </form>
      </CardContent>
    </Card>
  );
}
