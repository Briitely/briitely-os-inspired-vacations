import { TravelFileAside as Aside, TravelFileInfo as Info, TravelFilePanel as Panel, TravelFileSectionTitle as SectionTitle } from "@/components/app/travel-file-display";
import { formatBoolean, formatDateOnly, formatReadableDateTime } from "@/lib/travel/format";
import { formatStageLabel } from "@/lib/travel/stage-labels";
import type { TravelFile } from "@/lib/travel/types";

type FileWithAdvisor = TravelFile & { assigned_advisor: { id: string; full_name: string } | null };

type EditSection = (
  section: "trip" | "inquiry" | "booking" | "insurance" | "assignment",
  values: Record<string, string | number | boolean | null | undefined>
) => React.ReactNode;

export function AssignmentSection({ file, edit }: { file: FileWithAdvisor; edit: EditSection }) {
  return <Panel><div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]"><Aside eyebrow="Team" title="Assignment" text="Who owns this file and where it sits in the workflow." action={edit("assignment", { assignedAdvisorId: file.assigned_advisor_id })}/><div><SectionTitle>Ownership</SectionTitle><div className="grid gap-4 sm:grid-cols-3"><Info label="Assigned advisor" value={file.assigned_advisor?.full_name ?? "Unassigned"}/><Info label="Stage" value={formatStageLabel(file.stage)}/><Info label="Phase" value={<span className="capitalize">{file.phase}</span>}/></div></div></div></Panel>;
}

export function TripDetailsSection({ file, edit }: { file: FileWithAdvisor; edit: EditSection }) {
  return <Panel><div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]"><Aside eyebrow="Trip" title="Trip details" text="Core trip information used throughout planning." action={edit("trip", { destination: file.destination, tripType: file.trip_type, travelTimeframe: file.travel_timeframe, departureDate: file.departure_date, returnDate: file.return_date, budgetRange: file.budget_range, specialConsiderations: file.special_requests })}/><div><SectionTitle>Trip information</SectionTitle><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Info label="Destination" value={file.destination}/><Info label="Departure" value={file.departure_date ? formatDateOnly(file.departure_date) : "—"}/><Info label="Return" value={file.return_date ? formatDateOnly(file.return_date) : "—"}/><Info label="Trip type" value={file.trip_type}/><Info label="Travellers" value={file.number_of_travellers}/></div>{file.special_requests && <div className="mt-5"><SectionTitle>Special considerations</SectionTitle><p className="text-sm">{file.special_requests}</p></div>}</div></div></Panel>;
}

export function InsuranceSection({ file, edit }: { file: FileWithAdvisor; edit: EditSection }) {
  return <Panel><div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]"><Aside eyebrow="Pre-trip" title="Insurance" text="Insurance, pre-trip meeting and registration status." action={edit("insurance", { insuranceInterest: file.insurance_interest, insuranceStatus: file.insurance_status, insuranceWaiverSigned: file.insurance_waiver_signed, pretripMeetingRequired: file.pretrip_meeting_required, pretripMeetingBookedAt: file.pretrip_meeting_booked_at, pretripCardSentAt: file.pretrip_card_sent_at, bookingRegistrationEligible: file.booking_registration_eligible, bookingRegistrationDoneAt: file.booking_registration_done_at })}/><div><SectionTitle>Insurance & pre-trip</SectionTitle><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Info label="Insurance preference" value={file.insurance_interest}/><Info label="Status" value={<span className="capitalize">{file.insurance_status}</span>}/><Info label="Waiver signed" value={formatBoolean(file.insurance_waiver_signed)}/><Info label="Meeting required" value={formatBoolean(file.pretrip_meeting_required)}/><Info label="Meeting booked" value={file.pretrip_meeting_booked_at ? formatReadableDateTime(file.pretrip_meeting_booked_at) : "—"}/><Info label="Card sent" value={file.pretrip_card_sent_at ? formatReadableDateTime(file.pretrip_card_sent_at) : "—"}/><Info label="Registration eligible" value={formatBoolean(file.booking_registration_eligible)}/><Info label="Registration done" value={file.booking_registration_done_at ? formatReadableDateTime(file.booking_registration_done_at) : "—"}/></div></div></div></Panel>;
}
