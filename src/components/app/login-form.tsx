"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { Card, CardContent, CardHeader } from "@/components/core/ui/card";
import { Loader2, LogIn } from "lucide-react";
import Link from "next/link";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        if (signInError.message.toLowerCase().includes("invalid login credentials")) {
          setError("The email or password you entered is incorrect. Please try again.");
        } else {
          setError("We couldn't sign you in right now. Please try again in a moment.");
        }
        return;
      }

      if (!data.user) {
        setError("We couldn't sign you in. Please try again.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, is_active")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        setError("We couldn't load your account. Please try again.");
        return;
      }

      if (!profile) {
        await supabase.auth.signOut();
        setError("No account profile was found for your login. Please contact an administrator.");
        return;
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        setError("Your account is not active. Please contact an administrator.");
        return;
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-border shadow-md">
      <CardHeader className="space-y-1 pb-4">
        <h2 className="text-xl font-semibold text-center">Sign in to your account</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@scatteredacres.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-base">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full text-base"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-5 w-5" />
                Sign In
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
