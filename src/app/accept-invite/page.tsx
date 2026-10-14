import type { Metadata } from "next";
import { Suspense } from "react";
import { AcceptInviteForm } from "@/components/app/accept-invite-form";
import { AuthBrandHeader } from "@/components/app/auth-brand-header";

export const metadata: Metadata = {
  title: "Accept Invitation — Inspired Vacations",
};

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-7">
        <AuthBrandHeader />
        <Suspense fallback={null}>
          <AcceptInviteForm />
        </Suspense>
      </div>
    </div>
  );
}
