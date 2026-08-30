"use client";

import { useCallback } from "react";
import { ConsultationTravelPartyEditor, type ConsultationPartyMember } from "@/components/app/consultation-travel-party-editor";

export function CompleteConsultationTravelPartySection({
  travelFileId,
  onCountsChange,
}: {
  travelFileId: string;
  onCountsChange: (counts: { adults: number; children: number; total: number }) => void;
}) {
  const handlePartyChange = useCallback((party: ConsultationPartyMember[]) => {
    const children = party.filter((member) => member.relationship_to_primary === "child").length;
    const total = party.length;
    onCountsChange({ adults: Math.max(0, total - children), children, total });
  }, [onCountsChange]);

  return <ConsultationTravelPartyEditor travelFileId={travelFileId} onPartyChange={handlePartyChange} />;
}
