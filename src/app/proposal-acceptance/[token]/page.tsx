import type { Metadata } from "next";
import { CustomerProposalAcceptance } from "@/components/app/customer-proposal-acceptance";
import { AgreementPage } from "@/components/app/client-agreement-layout";

export const metadata: Metadata = { title: "Proposal Acceptance — Inspired Vacations" };

export default async function ProposalAcceptancePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AgreementPage>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Inspired Vacations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Review your proposal & deposit</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">Review your travel proposal and deposit agreement, then confirm your travel preferences and loyalty information.</p>
        <CustomerProposalAcceptance token={token} />
      </div>
    </AgreementPage>
  );
}
