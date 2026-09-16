"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { DeleteTravelFileDialog } from "@/components/app/delete-travel-file-dialog";
import { ResendProposalEmailButton } from "@/components/app/resend-proposal-email-button";
import { PaymentsTable } from "@/components/app/payments-table";
import { ActiveBookingSummary } from "@/components/app/active-booking-summary";
import { useTravelFileLayoutMounts } from "@/components/app/use-travel-file-layout-mounts";

interface TravelFileActionsProps {
  travelFileId: string;
  clientName: string;
  destination: string | null;
  tripType: string | null;
  travelTimeframe: string | null;
  departureDate: string | null;
  returnDate: string | null;
  numberOfAdults: number | null;
  numberOfChildren: number | null;
  childrenAges: string | null;
  budgetRange: string | null;
  insuranceInterest: string | null;
  specialConsiderations: string | null;
  staffNotes: string | null;
  assignedAdvisorId: string | null;
  canEdit: boolean;
  canDelete: boolean;
  stage: string;
  currentActionCode: string | null;
  currentActionStatus: string | null;
  previousNotes: Array<{
    id: string;
    note_type: string;
    note_text: string;
    created_at: string;
    author: { id: string; full_name: string } | null;
  }>;
}

export function TravelFileActions(props: TravelFileActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const {
    planningMount,
    bookingSummaryMount,
    paymentMount,
  } = useTravelFileLayoutMounts(props.travelFileId);

  return (
    <>
      {props.canDelete && (
        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" />
          Delete Travel File
        </Button>
      )}
      {planningMount &&
        createPortal(<ResendProposalEmailButton travelFileId={props.travelFileId} />, planningMount)}
      {bookingSummaryMount &&
        createPortal(<ActiveBookingSummary travelFileId={props.travelFileId} />, bookingSummaryMount)}
      {paymentMount && createPortal(<PaymentsTable travelFileId={props.travelFileId} />, paymentMount)}
      {props.canDelete && (
        <DeleteTravelFileDialog
          travelFileId={props.travelFileId}
          clientName={props.clientName}
          destination={props.destination}
          tripType={props.tripType}
          isOpen={deleteOpen}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </>
  );
}
