import type { Metadata } from "next";
import { Suspense } from "react";
import { AcceptInviteForm } from "@/components/app/accept-invite-form";

export const metadata: Metadata = {
  title: "Accept Invitation — Briitely OS",
};

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Briitely OS
          </h1>
          <p className="text-lg text-muted-foreground">
            Business Dashboard
          </p>
        </div>
        <Suspense fallback={null}>
          <AcceptInviteForm />
        </Suspense>
      </div>
    </div>
  );
}
