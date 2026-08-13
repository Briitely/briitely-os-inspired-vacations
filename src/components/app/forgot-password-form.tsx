"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/core/ui/button";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${appUrl}/reset-password`,
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <Card className="border-border shadow-md">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl text-center">Check your email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-2">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <p className="text-sm text-muted-foreground text-center">
              If an account exists for that email, we&apos;ve sent a password reset link.
            </p>
          </div>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-md">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl text-center">Forgot your password?</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <p className="text-sm text-muted-foreground text-center">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
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
          <Button
            type="submit"
            size="lg"
            className="w-full text-base"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Sending reset link...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-5 w-5" />
                Send Reset Link
              </>
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
