import type { Metadata } from "next";
import { AuthBrandHeader } from "@/components/app/auth-brand-header";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";

export const metadata: Metadata = {
  title: "Secure Account Link — Inspired Vacations",
};

export default async function AuthContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const action = params.action ?? "";
  const kind = params.kind === "invite" ? "invite" : "recovery";
  const invite = kind === "invite";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-7">
        <AuthBrandHeader />
        <Card className="border-border shadow-md">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">
              {invite ? "Set up your dashboard account" : "Reset your password"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground text-center">
              {invite
                ? "Click below to continue to the secure account setup."
                : "Click below to continue to the secure password reset."}
            </p>
            <form action="/api/auth/continue" method="post">
              <input type="hidden" name="action" value={action} />
              <Button type="submit" size="lg" className="w-full text-base" disabled={!action}>
                {invite ? "Set Up My Account" : "Reset My Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
