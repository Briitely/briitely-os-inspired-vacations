import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/app/reset-password-form";
import { AuthBrandHeader } from "@/components/app/auth-brand-header";

export const metadata: Metadata = {
  title: "Reset Password — Inspired Vacations",
};

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-7">
        <AuthBrandHeader />
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
