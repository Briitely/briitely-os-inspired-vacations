"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  ClipboardCheck,
  Eye,
  Handshake,
  Loader2,
  RefreshCw,
  SearchCheck,
  Send,
  Trash2,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { DeleteTravelFileDialog } from "@/components/app/delete-travel-file-dialog";
import { CompleteConsultationModal } from "@/components/app/complete-consultation-modal";
import { CompleteBookingModal } from "@/components/app/complete-booking-modal";
import { AssignProposalModal } from "@/components/app/assign-proposal-modal";
import { SendProposalModal } from "@/components/app/send-proposal-modal";
import { CheckProposalStatusModal } from "@/components/app/check-proposal-status-modal";
import { ReviewOpportunityStatusModal } from "@/components/app/review-opportunity-status-modal";
import { NegotiationModal } from "@/components/app/negotiation-modal";
import { ResendProposalEmailButton } from "@/components/app/resend-proposal-email-button";
import { PaymentsTable } from "@/components/app/payments-table";
import { CurrentActionTasks } from "@/components/app/current-action-tasks";
import {
  ActiveBookingSummary,
  InquiryPlanningSummary,
  RetainerRevisionSummary,
} from "@/components/app/active-booking-summary";
import { DepositConfirmationModal } from "@/components/app/deposit-confirmation-modal";
import { InactiveProposalReviewButtons } from "@/components/app/inactive-proposal-review-buttons";
import { SendTmfModal } from "@/components/app/send-tmf-modal";
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

type ResendDetails = {
  clientName: string;
  email: string;
  phone: string;
  destination: string | null;
  assignedAdvisorName: string | null;
  tmfAmount: number | null;
  revisionsIncluded: number | null;
};

export function TravelFileActions(props: TravelFileActionsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [assignProposalOpen, setAssignProposalOpen] = useState(false);
  const [sendProposalOpen, setSendProposalOpen] = useState(false);
  const [checkProposalOpen, setCheckProposalOpen] = useState(false);
  const [reviewOpportunityOpen, setReviewOpportunityOpen] = useState(false);
  const [negotiationOpen, setNegotiationOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [resendFormsOpen, setResendFormsOpen] = useState(false);
  const [resendDetails, setResendDetails] = useState<ResendDetails | null>(null);
  const [markingRetainer, setMarkingRetainer] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isActive = props.canEdit && props.currentActionStatus === "active";
  const showConsult = isActive && props.currentActionCode === "complete_initial_consultation";
  const showCompleteBooking = isActive && props.currentActionCode === "complete_booking";
  const showRetainerReceived = isActive && props.currentActionCode === "collect_tmf_payment";
  const showDepositReceived = isActive && props.currentActionCode === "collect_deposit";
  const showAssignProposal = isActive && props.currentActionCode === "assign_proposal";
  const showSendProposal =
    isActive &&
    (props.currentActionCode === "create_proposal" || props.currentActionCode === "send_proposal");
  const showCheckProposal = isActive && props.currentActionCode === "check_proposal_status";
  const showReviewOpportunity = isActive && props.currentActionCode === "review_proposal_opportunity";
  const showInactiveProposalReview = isActive && props.currentActionCode === "review_inactive_proposal";
  const showNegotiating = isActive && props.currentActionCode === "negotiate_proposal";
  const showResendForms = isActive && props.currentActionCode === "await_tmf_and_booking_form";

  const {
    actionMount,
    tasksMount,
    planningMount,
    bookingSummaryMount,
    inquirySummaryMount,
    retainerSummaryMount,
    paymentMount,
  } = useTravelFileLayoutMounts(
    props.travelFileId,
    props.currentActionCode,
    props.currentActionStatus,
  );

  useEffect(() => {
    if (!showResendForms) {
      setResendDetails(null);
      return;
    }
    let active = true;
    fetch(`/api/travel-files/${encodeURIComponent(props.travelFileId)}/current-action`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active) setResendDetails(data?.resendForms ?? null);
      })
      .catch(() => {
        if (active) setResendDetails(null);
      });
    return () => {
      active = false;
    };
  }, [props.travelFileId, showResendForms]);

  async function markRetainerReceived() {
    if (!window.confirm("Confirm that the Retainer payment has been collected in CBO?")) return;
    setMarkingRetainer(true);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/travel-files/${encodeURIComponent(props.travelFileId)}/retainer-received`,
        { method: "POST" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not mark the Retainer as received.");
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not mark the Retainer as received.");
    } finally {
      setMarkingRetainer(false);
    }
  }

  return (
    <>
      {props.canDelete && (
        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" />
          Delete Travel File
        </Button>
      )}
      {actionMount && showConsult &&
        createPortal(
          <Button size="sm" className="w-full sm:w-auto" onClick={() => setConsultOpen(true)}>
            <ClipboardCheck className="h-4 w-4" />
            Complete Initial Consultation
          </Button>,
          actionMount,
        )}
      {actionMount && showCompleteBooking &&
        createPortal(
          <Button size="sm" className="w-full sm:w-auto" onClick={() => setBookingOpen(true)}>
            <BookOpenCheck className="h-4 w-4" />
            Complete Booking
          </Button>,
          actionMount,
        )}
      {actionMount && showRetainerReceived &&
        createPortal(
          <Button size="sm" onClick={markRetainerReceived} disabled={markingRetainer}>
            {markingRetainer ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <WalletCards className="h-4 w-4" />
            )}
            Retainer Received
          </Button>,
          actionMount,
        )}
      {actionMount && showDepositReceived &&
        createPortal(
          <Button size="sm" onClick={() => setDepositOpen(true)}>
            <WalletCards className="h-4 w-4" />
            Process Deposit
          </Button>,
          actionMount,
        )}
      {actionMount && showAssignProposal &&
        createPortal(
          <Button size="sm" onClick={() => setAssignProposalOpen(true)}>
            <UserRoundCheck className="h-4 w-4" />
            Assign Proposal
          </Button>,
          actionMount,
        )}
      {actionMount && showSendProposal &&
        createPortal(
          <Button size="sm" onClick={() => setSendProposalOpen(true)}>
            <Send className="h-4 w-4" />
            Send Proposal
          </Button>,
          actionMount,
        )}
      {actionMount && showCheckProposal &&
        createPortal(
          <Button size="sm" onClick={() => setCheckProposalOpen(true)}>
            <Eye className="h-4 w-4" />
            Check Proposal Status
          </Button>,
          actionMount,
        )}
      {actionMount && showReviewOpportunity &&
        createPortal(
          <Button size="sm" onClick={() => setReviewOpportunityOpen(true)}>
            <SearchCheck className="h-4 w-4" />
            Review Opportunity
          </Button>,
          actionMount,
        )}
      {actionMount && showInactiveProposalReview &&
        createPortal(
          <InactiveProposalReviewButtons travelFileId={props.travelFileId} />,
          actionMount,
        )}
      {actionMount && showNegotiating &&
        createPortal(
          <Button size="sm" onClick={() => setNegotiationOpen(true)}>
            <Handshake className="h-4 w-4" />
            Manage Negotiation
          </Button>,
          actionMount,
        )}
      {actionMount && showResendForms && resendDetails &&
        createPortal(
          <Button size="sm" onClick={() => setResendFormsOpen(true)}>
            <RefreshCw className="h-4 w-4" />
            Resend Forms
          </Button>,
          actionMount,
        )}
      {planningMount &&
        createPortal(<ResendProposalEmailButton travelFileId={props.travelFileId} />, planningMount)}
      {bookingSummaryMount &&
        createPortal(<ActiveBookingSummary travelFileId={props.travelFileId} />, bookingSummaryMount)}
      {inquirySummaryMount &&
        createPortal(<InquiryPlanningSummary travelFileId={props.travelFileId} />, inquirySummaryMount)}
      {retainerSummaryMount &&
        createPortal(<RetainerRevisionSummary travelFileId={props.travelFileId} />, retainerSummaryMount)}
      {paymentMount && createPortal(<PaymentsTable travelFileId={props.travelFileId} />, paymentMount)}
      {tasksMount && props.currentActionStatus === "active" &&
        createPortal(<CurrentActionTasks travelFileId={props.travelFileId} />, tasksMount)}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {showResendForms && resendDetails && resendFormsOpen && (
        <SendTmfModal
          travelFileId={props.travelFileId}
          clientName={resendDetails.clientName}
          email={resendDetails.email}
          phone={resendDetails.phone}
          destination={resendDetails.destination}
          assignedAdvisorName={resendDetails.assignedAdvisorName}
          tmfAmount={resendDetails.tmfAmount}
          revisionsIncluded={resendDetails.revisionsIncluded}
          agreementDate={new Date().toLocaleDateString("en-CA")}
          mode="resend"
          isOpen={resendFormsOpen}
          onClose={() => setResendFormsOpen(false)}
        />
      )}
      {showDepositReceived && (
        <DepositConfirmationModal
          travelFileId={props.travelFileId}
          isOpen={depositOpen}
          onClose={() => setDepositOpen(false)}
          onConfirmed={() => router.refresh()}
        />
      )}
      {showConsult && consultOpen && (
        <CompleteConsultationModal
          key={`consult-${props.travelFileId}-${consultOpen}`}
          travelFileId={props.travelFileId}
          clientName={props.clientName}
          destination={props.destination}
          tripType={props.tripType}
          travelTimeframe={props.travelTimeframe}
          departureDate={props.departureDate}
          returnDate={props.returnDate}
          numberOfAdults={props.numberOfAdults}
          numberOfChildren={props.numberOfChildren}
          childrenAges={props.childrenAges}
          budgetRange={props.budgetRange}
          specialConsiderations={props.specialConsiderations}
          insuranceInterest={props.insuranceInterest}
          assignedAdvisorId={props.assignedAdvisorId}
          staffNotes={props.staffNotes}
          previousNotes={props.previousNotes}
          isOpen={consultOpen}
          onClose={() => setConsultOpen(false)}
        />
      )}
      {showCompleteBooking && bookingOpen && (
        <CompleteBookingModal
          travelFileId={props.travelFileId}
          departureDate={props.departureDate}
          returnDate={props.returnDate}
          isOpen={bookingOpen}
          onClose={() => setBookingOpen(false)}
        />
      )}
      {showAssignProposal && assignProposalOpen && (
        <AssignProposalModal
          travelFileId={props.travelFileId}
          assignedAdvisorId={props.assignedAdvisorId}
          currentProposalDueDate={null}
          isOpen={assignProposalOpen}
          onClose={() => setAssignProposalOpen(false)}
        />
      )}
      {showSendProposal && sendProposalOpen && (
        <SendProposalModal
          travelFileId={props.travelFileId}
          isOpen={sendProposalOpen}
          onClose={() => setSendProposalOpen(false)}
        />
      )}
      {showCheckProposal && checkProposalOpen && (
        <CheckProposalStatusModal
          travelFileId={props.travelFileId}
          isOpen={checkProposalOpen}
          onClose={() => setCheckProposalOpen(false)}
        />
      )}
      {showReviewOpportunity && reviewOpportunityOpen && (
        <ReviewOpportunityStatusModal
          travelFileId={props.travelFileId}
          isOpen={reviewOpportunityOpen}
          onClose={() => setReviewOpportunityOpen(false)}
        />
      )}
      {showNegotiating && negotiationOpen && (
        <NegotiationModal
          travelFileId={props.travelFileId}
          isOpen={negotiationOpen}
          onClose={() => setNegotiationOpen(false)}
        />
      )}
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
