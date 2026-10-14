import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/app/forgot-password-form";
import { AuthBrandHeader } from "@/components/app/auth-brand-header";

export const metadata: Metadata = {
  title: "Forgot Password — Inspired Vacations",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-7">
        <AuthBrandHeader />
        <Suspense fallback={null}>
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
