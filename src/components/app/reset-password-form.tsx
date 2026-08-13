"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";

type State = "verifying" | "valid" | "expired" | "success";

export function ResetPasswordForm() {
  const router = useRouter();
  const [state, setState] = useState<State>("verifying");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        setState("expired");
      }
    }, 8000);

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) {
          resolved = true;
          clearTimeout(timeout);
          setState("valid");
        }
      }
    );

    return () => {
      resolved = true;
      clearTimeout(timeout);
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError("Please enter a new password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError("We couldn't update your password. Please try again or request a new reset link.");
        return;
      }

      setState("success");
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (state === "verifying") {
    return (
      <Card className="border-border shadow-md">
        <CardContent className="space-y-4 py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Verifying your reset link...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === "expired") {
    return (
      <Card className="border-border shadow-md">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl text-center">Link expired</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-2">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-muted-foreground text-center">
              This password reset link is no longer valid.
            </p>
          </div>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/forgot-password">Request a new reset link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state === "success") {
    return (
      <Card className="border-border shadow-md">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl text-center">Password updated</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-2">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <p className="text-sm text-muted-foreground text-center">
              Your password has been updated. Redirecting you to sign in...
            </p>
          </div>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-md">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl text-center">Choose a new password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-base">New Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-base">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
            />
          </div>
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full text-base"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Updating password...
              </>
            ) : (
              "Update Password"
            )}
          </Button>
          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
