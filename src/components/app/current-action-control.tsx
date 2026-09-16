"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  ClipboardCheck,
  Eye,
  Handshake,
  RefreshCw,
  SearchCheck,
  Send,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { CompleteConsultationModal } from "@/components/app/complete-consultation-modal";
import { CompleteBookingModal } from "@/components/app/complete-booking-modal";
import { AssignProposalModal } from "@/components/app/assign-proposal-modal";
import { SendProposalModal } from "@/components/app/send-proposal-modal";
import { CheckProposalStatusModal } from "@/components/app/check-proposal-status-modal";
import { ReviewOpportunityStatusModal } from "@/components/app/review-opportunity-status-modal";
import { NegotiationModal } from "@/components/app/negotiation-modal";
import { DepositConfirmationModal } from "@/components/app/deposit-confirmation-modal";
import { RetainerConfirmationModal } from "@/components/app/retainer-confirmation-modal";
import { InactiveProposalReviewButtons } from "@/components/app/inactive-proposal-review-buttons";
import { InvoicingItineraryButton } from "@/components/app/invoicing-itinerary-button";
import { SendTmfModal } from "@/components/app/send-tmf-modal";

type ResendDetails = {
  clientName: string;
  email: string;
  phone: string;
  destination: string | null;
  assignedAdvisorName: string | null;
  tmfAmount: number | null;
  revisionsIncluded: number | null;
};

type Props = {
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
  currentActionCode: string | null;
  currentActionStatus: string | null;
  previousNotes: Array<{
    id: string;
    note_type: string;
    note_text: string;
    created_at: string;
    author: { id: string; full_name: string } | null;
  }>;
};

export function CurrentActionControl(props: Props) {
  const router = useRouter();
  const [consultOpen, setConsultOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [assignProposalOpen, setAssignProposalOpen] = useState(false);
  const [sendProposalOpen, setSendProposalOpen] = useState(false);
  const [checkProposalOpen, setCheckProposalOpen] = useState(false);
  const [reviewOpportunityOpen, setReviewOpportunityOpen] = useState(false);
  const [negotiationOpen, setNegotiationOpen] = useState(false);
  const [retainerOpen, setRetainerOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [resendFormsOpen, setResendFormsOpen] = useState(false);
  const [resendDetails, setResendDetails] = useState<ResendDetails | null>(null);

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
  const showInvoicingItinerary = isActive && props.currentActionCode === "invoicing_itinerary";

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

  const control = showConsult ? (
    <Button size="sm" className="w-full sm:w-auto" onClick={() => setConsultOpen(true)}>
      <ClipboardCheck className="h-4 w-4" />
      Complete Initial Consultation
    </Button>
  ) : showCompleteBooking ? (
    <Button size="sm" className="w-full sm:w-auto" onClick={() => setBookingOpen(true)}>
      <BookOpenCheck className="h-4 w-4" />
      Complete Booking
    </Button>
  ) : showRetainerReceived ? (
    <Button size="sm" onClick={() => setRetainerOpen(true)}>
      <WalletCards className="h-4 w-4" />
      Retainer Received
    </Button>
  ) : showDepositReceived ? (
    <Button size="sm" onClick={() => setDepositOpen(true)}>
      <WalletCards className="h-4 w-4" />
      Process Deposit
    </Button>
  ) : showAssignProposal ? (
    <Button size="sm" onClick={() => setAssignProposalOpen(true)}>
      <UserRoundCheck className="h-4 w-4" />
      Assign Proposal
    </Button>
  ) : showSendProposal ? (
    <Button size="sm" onClick={() => setSendProposalOpen(true)}>
      <Send className="h-4 w-4" />
      Send Proposal
    </Button>
  ) : showCheckProposal ? (
    <Button size="sm" onClick={() => setCheckProposalOpen(true)}>
      <Eye className="h-4 w-4" />
      Check Proposal Status
    </Button>
  ) : showReviewOpportunity ? (
    <Button size="sm" onClick={() => setReviewOpportunityOpen(true)}>
      <SearchCheck className="h-4 w-4" />
      Review Opportunity
    </Button>
  ) : showInactiveProposalReview ? (
    <InactiveProposalReviewButtons travelFileId={props.travelFileId} />
  ) : showNegotiating ? (
    <Button size="sm" onClick={() => setNegotiationOpen(true)}>
      <Handshake className="h-4 w-4" />
      Manage Negotiation
    </Button>
  ) : showInvoicingItinerary ? (
    <InvoicingItineraryButton travelFileId={props.travelFileId} />
  ) : showResendForms && resendDetails ? (
    <Button size="sm" onClick={() => setResendFormsOpen(true)}>
      <RefreshCw className="h-4 w-4" />
      Resend Forms
    </Button>
  ) : null;

  return (
    <>
      {control}

      {showRetainerReceived && (
        <RetainerConfirmationModal
          travelFileId={props.travelFileId}
          isOpen={retainerOpen}
          onClose={() => setRetainerOpen(false)}
          onConfirmed={() => router.refresh()}
        />
      )}
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
    </>
  );
}
