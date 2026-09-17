import { ActiveBookingSummary, InquiryPlanningSummary, RetainerRevisionSummary } from "@/components/app/active-booking-summary";
import { ResendProposalEmailButton } from "@/components/app/resend-proposal-email-button";
import { TravelFileAside as Aside, TravelFileInfo as Info, TravelFilePanel as Panel, TravelFileSectionTitle as SectionTitle } from "@/components/app/travel-file-display";
import { formatCurrency, formatDateOnly, formatReadableDate } from "@/lib/travel/format";
import type { TravelFile } from "@/lib/travel/types";

type FileWithAdvisor = TravelFile & { assigned_advisor: { id: string; full_name: string } | null };

type EditSection = (
  section: "trip" | "inquiry" | "booking" | "insurance" | "assignment",
  values: Record<string, string | number | boolean | null | undefined>
) => React.ReactNode;

export function BookingPlanningSection({ file, edit }: { file: FileWithAdvisor; edit: EditSection }) {
  return <Panel><div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]"><Aside eyebrow="Planning" title="Booking & planning" text="Proposal, booking and planning references." action={<><div>{edit("booking", { proposalDueDate: file.proposal_due_date, dateBooked: file.date_booked, totalBookingValue: file.total_booking_value, tmfAmount: file.tmf_amount, clientbaseResCardId: file.clientbase_res_card_id, primaryBookingNumber: file.primary_booking_number, travefyProposalUrl: file.travefy_proposal_url, travefyTripPlanUrl: file.travefy_trip_plan_url })}</div><div className="mt-2"><ResendProposalEmailButton travelFileId={file.id}/></div></>}/><div><SectionTitle>Booking information</SectionTitle><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Info label="Date booked" value={file.date_booked ? formatDateOnly(file.date_booked) : "—"}/><Info label="Booking value" value={formatCurrency(file.total_booking_value)}/><Info label="ClientBase res card" value={file.clientbase_res_card_id}/><Info label="Booking number" value={file.primary_booking_number}/><Info label="Travefy proposal" value={file.travefy_proposal_url ? <a className="text-primary hover:underline" href={file.travefy_proposal_url} target="_blank" rel="noreferrer">Open proposal</a> : "—"}/><Info label="Travefy trip plan" value={file.travefy_trip_plan_url ? <a className="text-primary hover:underline" href={file.travefy_trip_plan_url} target="_blank" rel="noreferrer">Open trip plan</a> : "—"}/><ActiveBookingSummary travelFileId={file.id}/></div></div></div></Panel>;
}

export function RetainerDetailsSection({ file }: { file: FileWithAdvisor }) {
  if (file.tmf_amount == null && file.revisions_included == null) return null;
  return <Panel><div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]"><Aside eyebrow="Consultation" title="Retainer details" text="Consultation outcome and Retainer details."/><div><SectionTitle>Retainer</SectionTitle><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Info label="Client fit" value="Yes"/><Info label="Retainer amount" value={formatCurrency(file.tmf_amount)}/><Info label="Assigned advisor" value={file.assigned_advisor?.full_name ?? "Unassigned"}/><RetainerRevisionSummary travelFileId={file.id}/></div></div></div></Panel>;
}

export function InquiryDetailsSection({ file, edit }: { file: FileWithAdvisor; edit: EditSection }) {
  return <Panel><div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]"><Aside eyebrow="Inquiry" title="Inquiry details" text="Where the inquiry came from and intake notes." action={edit("inquiry", { inquirySource: file.inquiry_source, intakeMethod: file.intake_method, referralDetail: file.referral_detail, eventDetail: file.event_detail, staffNotes: file.staff_notes, internalNotes: file.internal_notes })}/><div><SectionTitle>Source & intake</SectionTitle><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Info label="Source" value={file.inquiry_source}/><Info label="Received" value={formatReadableDate(file.inquiry_received_at)}/><Info label="Intake method" value={file.intake_method}/><Info label="Referral" value={file.referral_detail}/><Info label="Event" value={file.event_detail}/><InquiryPlanningSummary travelFileId={file.id}/></div>{file.staff_notes && <div className="mt-5"><SectionTitle>Staff notes</SectionTitle><p className="text-sm">{file.staff_notes}</p></div>}</div></div></Panel>;
}
