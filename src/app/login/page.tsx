import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/app/login-form";
import { getBrandingSettings, getBusinessSettings } from "@/lib/briitely/client-settings";

export const metadata: Metadata = {
  title: "Sign In — Briitely OS",
};

export default async function LoginPage() {
  const [branding, business] = await Promise.all([
    getBrandingSettings(),
    getBusinessSettings(),
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-7">
        <div className="text-center">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={`${business.businessName} logo`}
              className="mx-auto max-h-24 max-w-[260px] object-contain"
            />
          ) : (
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {business.businessName}
            </h1>
          )}
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Briitely OS · Business Dashboard
          </p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
