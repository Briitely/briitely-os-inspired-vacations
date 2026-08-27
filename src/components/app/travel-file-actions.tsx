"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { EditTravelFileModal, type TravelFileData } from "@/components/app/edit-travel-file-modal";
import { DeleteTravelFileDialog } from "@/components/app/delete-travel-file-dialog";

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
  insuranceInterest: boolean;
  specialConsiderations: string | null;
  travelInterests: string[];
  travelSeasons: string[];
  inquirySource: string | null;
  intakeMethod: string | null;
  referralDetail: string | null;
  eventDetail: string | null;
  staffNotes: string | null;
  internalNotes: string | null;
  assignedAdvisorId: string | null;
  updatedAt: string;
  // Booking / Planning
  proposalDueDate: string | null;
  dateBooked: string | null;
  totalBookingValue: number | null;
  tmfAmount: number | null;
  ivtCustom: boolean | null;
  clientbaseResCardId: string | null;
  primaryBookingNumber: string | null;
  travefyProposalUrl: string | null;
  travefyTripPlanUrl: string | null;
  // Insurance / Pre-Trip
  insuranceStatus: string;
  insuranceWaiverSigned: boolean | null;
  pretripMeetingRequired: boolean | null;
  pretripMeetingBookedAt: string | null;
  pretripCardSentAt: string | null;
  bookingRegistrationEligible: boolean;
  bookingRegistrationDoneAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

export function TravelFileActions(props: TravelFileActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const travelFileData: TravelFileData = {
    id: props.travelFileId,
    destination: props.destination,
    tripType: props.tripType,
    travelTimeframe: props.travelTimeframe,
    departureDate: props.departureDate,
    returnDate: props.returnDate,
    numberOfAdults: props.numberOfAdults,
    numberOfChildren: props.numberOfChildren,
    childrenAges: props.childrenAges,
    budgetRange: props.budgetRange,
    insuranceInterest: props.insuranceInterest,
    specialConsiderations: props.specialConsiderations,
    travelInterests: props.travelInterests,
    travelSeasons: props.travelSeasons,
    inquirySource: props.inquirySource,
    intakeMethod: props.intakeMethod,
    referralDetail: props.referralDetail,
    eventDetail: props.eventDetail,
    staffNotes: props.staffNotes,
    internalNotes: props.internalNotes,
    assignedAdvisorId: props.assignedAdvisorId,
    updatedAt: props.updatedAt,
    proposalDueDate: props.proposalDueDate,
    dateBooked: props.dateBooked,
    totalBookingValue: props.totalBookingValue,
    tmfAmount: props.tmfAmount,
    ivtCustom: props.ivtCustom,
    clientbaseResCardId: props.clientbaseResCardId,
    primaryBookingNumber: props.primaryBookingNumber,
    travefyProposalUrl: props.travefyProposalUrl,
    travefyTripPlanUrl: props.travefyTripPlanUrl,
    insuranceStatus: props.insuranceStatus as TravelFileData["insuranceStatus"],
    insuranceWaiverSigned: props.insuranceWaiverSigned,
    pretripMeetingRequired: props.pretripMeetingRequired,
    pretripMeetingBookedAt: props.pretripMeetingBookedAt,
    pretripCardSentAt: props.pretripCardSentAt,
    bookingRegistrationEligible: props.bookingRegistrationEligible,
    bookingRegistrationDoneAt: props.bookingRegistrationDoneAt,
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {props.canEdit && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit Travel File
          </Button>
        )}
        {props.canDelete && (
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Delete Travel File
          </Button>
        )}
      </div>

      {props.canEdit && editOpen && (
        <EditTravelFileModal
          key={`edit-${props.travelFileId}-${editOpen}`}
          travelFile={travelFileData}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
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
