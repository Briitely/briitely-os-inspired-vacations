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
  const [actionMount, setActionMount] = useState<HTMLElement | null>(null);
  const [tasksMount, setTasksMount] = useState<HTMLElement | null>(null);
  const [planningMount, setPlanningMount] = useState<HTMLElement | null>(null);
  const [bookingSummaryMount, setBookingSummaryMount] = useState<HTMLElement | null>(null);
  const [inquirySummaryMount, setInquirySummaryMount] = useState<HTMLElement | null>(null);
  const [retainerSummaryMount, setRetainerSummaryMount] = useState<HTMLElement | null>(null);
  const [paymentMount, setPaymentMount] = useState<HTMLElement | null>(null);
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

  useEffect(() => {
    let action: HTMLElement | null = null;
    let tasks: HTMLElement | null = null;
    let planning: HTMLElement | null = null;
    let bookingSummary: HTMLElement | null = null;
    let inquirySummary: HTMLElement | null = null;
    let retainerSummary: HTMLElement | null = null;
    let payment: HTMLElement | null = null;
    let oldPaymentContent: HTMLElement | null = null;

    const main = document.querySelector("main");
    const panels = [...document.querySelectorAll("main > div")] as HTMLElement[];
    const workflow = panels.find(
      (element) =>
        element.textContent?.includes("Current action") &&
        element.textContent?.includes("Due / Waiting"),
    );

    if (workflow) {
      const details = workflow.querySelector(
        ".md\\:grid-cols-\\[220px_minmax\\(0\\,1fr\\)\\] > div:nth-child(2)",
      ) as HTMLElement | null;
      if (details) {
        const infoRow = [...details.querySelectorAll("div")].find(
          (element) =>
            element.textContent?.includes("Responsible") &&
            element.textContent?.includes("Due / Waiting") &&
            element.className.includes("mt-4"),
        ) as HTMLElement | undefined;
        if (infoRow) {
          infoRow.className = "mt-4 grid gap-4 sm:grid-cols-3 sm:items-end";
          const infoGrid = infoRow.firstElementChild as HTMLElement | null;
          if (infoGrid) infoGrid.className = "grid gap-4 sm:col-span-2 sm:grid-cols-2";
          action = document.createElement("div");
          action.className = "min-h-9";
          infoRow.appendChild(action);
          setActionMount(action);
        }
        tasks = document.createElement("div");
        details.appendChild(tasks);
        setTasksMount(tasks);
      }
    }

    const fieldBlock = (panel: HTMLElement, label: string) => {
      const target = label.trim().toLowerCase();
      const leaf = [...panel.querySelectorAll("div,span,p")].find(
        (element) =>
          element.children.length === 0 &&
          element.textContent?.trim().toLowerCase() === target,
      ) as HTMLElement | undefined;
      return leaf?.parentElement as HTMLElement | null;
    };
    const hideInfo = (panel: HTMLElement, labels: string[]) => {
      for (const label of labels) {
        const block = fieldBlock(panel, label);
        if (block) block.style.display = "none";
      }
    };

    const trip = panels.find(
      (element) =>
        element.textContent?.includes("Trip details") && element.textContent?.includes("Trip information"),
    );
    if (trip) {
      hideInfo(trip, ["Travel timeframe", "Budget"]);
      const grid = trip.querySelector(
        ".md\\:grid-cols-\\[220px_minmax\\(0\\,1fr\\)\\] > div:nth-child(2) .grid",
      ) as HTMLElement | null;
      if (grid) {
        const byLabel = (label: string) => fieldBlock(trip, label);
        const order = [
          byLabel("Destination"),
          byLabel("Departure"),
          byLabel("Return"),
          byLabel("Trip Type"),
          byLabel("Travellers"),
        ].filter((element): element is HTMLElement => Boolean(element));
        for (const element of order) grid.appendChild(element);
      }
    }

    const inquiry = panels.find(
      (element) =>
        element.textContent?.includes("Inquiry details") && element.textContent?.includes("Source & intake"),
    );
    if (inquiry) {
      const grid = inquiry.querySelector(
        ".md\\:grid-cols-\\[220px_minmax\\(0\\,1fr\\)\\] > div:nth-child(2) .grid",
      ) as HTMLElement | null;
      if (grid) {
        inquirySummary = document.createElement("div");
        inquirySummary.className = "contents";
        grid.appendChild(inquirySummary);
        setInquirySummaryMount(inquirySummary);
      }
    }

    const retainer = panels.find(
      (element) =>
        element.textContent?.includes("Retainer details") &&
        element.textContent?.includes("Revisions included"),
    );
    if (retainer) {
      const grid = retainer.querySelector(
        ".md\\:grid-cols-\\[220px_minmax\\(0\\,1fr\\)\\] > div:nth-child(2) .grid",
      ) as HTMLElement | null;
      if (grid) {
        hideInfo(retainer, ["Revisions included", "Revisions used"]);
        retainerSummary = document.createElement("div");
        retainerSummary.className = "contents";
        grid.appendChild(retainerSummary);
        setRetainerSummaryMount(retainerSummary);
      }
    }

    const booking = panels.find(
      (element) =>
        element.textContent?.includes("Booking & planning") &&
        element.textContent?.includes("Booking information"),
    );
    if (booking) {
      hideInfo(booking, ["Proposal due", "Retainer", "Revisions used", "Revisions included"]);
      const aside = booking.querySelector(
        ".md\\:grid-cols-\\[220px_minmax\\(0\\,1fr\\)\\] > div:first-child",
      ) as HTMLElement | null;
      if (aside) {
        planning = document.createElement("div");
        planning.className = "mt-2";
        aside.appendChild(planning);
        setPlanningMount(planning);
      }
      const infoGrid = booking.querySelector(
        ".md\\:grid-cols-\\[220px_minmax\\(0\\,1fr\\)\\] > div:nth-child(2) .grid",
      ) as HTMLElement | null;
      if (infoGrid) {
        bookingSummary = document.createElement("div");
        bookingSummary.className = "contents";
        infoGrid.appendChild(bookingSummary);
        setBookingSummaryMount(bookingSummary);
      }
    }

    const paymentsPanel = panels.find(
      (element) =>
        element.textContent?.includes("Payments") &&
        element.textContent?.includes("Payment schedule and current status"),
    );
    if (paymentsPanel) {
      const content = paymentsPanel.querySelector(
        ".md\\:grid-cols-\\[220px_minmax\\(0\\,1fr\\)\\] > div:nth-child(2)",
      ) as HTMLElement | null;
      if (content) {
        oldPaymentContent = content.firstElementChild as HTMLElement | null;
        if (oldPaymentContent) oldPaymentContent.style.display = "none";
        payment = document.createElement("div");
        content.appendChild(payment);
        setPaymentMount(payment);
      }
    }

    if (main) {
      const direct = [...main.children] as HTMLElement[];
      const find = (...needles: string[]) =>
        direct.find((element) => needles.every((needle) => element.textContent?.includes(needle)));
      const ordered = [
        find("Current action", "Due / Waiting"),
        find("Team", "Assignment", "Ownership"),
        find("Travel Party", "Who is travelling on this trip"),
        find("Trip details", "Trip information"),
        find("Booking & planning", "Booking information"),
        find("Pre-trip", "Insurance", "Insurance & pre-trip"),
        find("Notes"),
        find("Payments", "Payment schedule and current status"),
        find("Consultation", "Retainer details"),
        find("Inquiry", "Inquiry details"),
        find("History", "Consultations"),
        find("History", "Actions"),
        find("History", "Activity"),
      ].filter((element): element is HTMLElement => Boolean(element));
      for (const element of ordered) main.appendChild(element);
    }

    return () => {
      action?.remove();
      tasks?.remove();
      planning?.remove();
      bookingSummary?.remove();
      inquirySummary?.remove();
      retainerSummary?.remove();
      payment?.remove();
      if (oldPaymentContent) oldPaymentContent.style.display = "";
    };
  }, [props.travelFileId, props.currentActionCode, props.currentActionStatus]);

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
