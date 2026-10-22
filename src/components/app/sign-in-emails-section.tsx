import { WorkspaceSection, DetailGroup, DetailItem } from "@/components/core/workspace-section";
import { BriitelyEmailSample } from "@/components/app/briitely-email-sample";

/** Super Admin only, on Users & Access: how sign-in emails are sent, and Send sample to Briitely (same as High Q). */
export function SignInEmailsSection({ enabled, defaultEmail }: { enabled: boolean; defaultEmail: string }) {
  return (
    <WorkspaceSection eyebrow="Email" title="Sign-in Emails" description="Invitations and password resets are sent through the client's Briitely email workflow, like every Briitely dashboard.">
      <div className="space-y-5">
        <DetailGroup label="Delivery" columns={2}>
          <DetailItem label="Sent through" value={enabled ? "Briitely email workflow" : "Not set up: invitations and password resets can't be sent"} />
          <DetailItem label="Setting" value={enabled ? "BRIITELY_EMAIL_WEBHOOK_URL is set" : "BRIITELY_EMAIL_WEBHOOK_URL isn't set in Vercel"} />
        </DetailGroup>
        <BriitelyEmailSample defaultEmail={defaultEmail} enabled={enabled} />
      </div>
    </WorkspaceSection>
  );
}
