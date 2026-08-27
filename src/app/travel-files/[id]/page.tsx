import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, CalendarDays, UserRound, AlertCircle } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { SharedFooter } from "@/components/app/shared-footer";
import { TravelFileActions } from "@/components/app/travel-file-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Badge } from "@/components/core/ui/badge";
import { Button } from "@/components/core/ui/button";
import { formatStageLabel, formatStageBadgeVariant } from "@/lib/travel/stage-labels";
import {
  formatDueOrWaiting,
  formatReadableDate,
  formatReadableDateTime,
  formatDateOnly,
  formatCurrency,
  formatBoolean,
  isOverdue,
} from "@/lib/travel/format";
import type {
  TravelFile,
  TravelAction,
  TravelPayment,
  TravelConsultation,
  TravelActivity,
} from "@/lib/travel/types";

export const metadata: Metadata = {
  title: "Travel File — Inspired Vacations",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

function getResponsibleName(
  action: TravelAction,
  profileMap: Record<string, string>
): string {
  if (action.responsible_type === "client") return "Client";
  if (action.responsible_type === "system") return "System";
  if (action.responsible_type === "internal") {
    return action.responsible_user_id
      ? profileMap[action.responsible_user_id] ?? "Unassigned"
      : "Unassigned";
  }
  return "Unassigned";
}

export default async function TravelFilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    redirect("/login?redirect=/dashboard");
  }

  const { id } = await params;
  const supabase = await createClient();

  // Load travel file with current action and assigned advisor
  const { data: rawFile, error: fileError } = await supabase
    .from("travel_files")
    .select(`
      *,
      current_action:travel_actions!current_action_id (*),
      assigned_advisor:profiles!assigned_advisor_id (id, full_name)
    `)
    .eq("id", id)
    .maybeSingle();

  if (fileError || !rawFile) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role} />
        <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="p-6 space-y-4">
              <p className="text-sm text-destructive">Travel File not found.</p>
              <Button variant="outline" asChild>
                <Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const file = rawFile as unknown as TravelFile & {
    current_action: TravelAction | null;
    assigned_advisor: { id: string; full_name: string } | null;
  };

  // Load all actions for this travel file
  const { data: rawActions } = await supabase
    .from("travel_actions")
    .select("*")
    .eq("travel_file_id", id)
    .order("created_at", { ascending: true });

  // Load payments
  const { data: rawPayments } = await supabase
    .from("travel_payments")
    .select("*")
    .eq("travel_file_id", id)
    .order("due_date", { ascending: true });

  // Load consultations with conducted_by and assigned_advisor profiles
  const { data: rawConsultations } = await supabase
    .from("travel_consultations")
    .select(`
      *,
      conducted_by_profile:profiles!conducted_by (id, full_name),
      assigned_advisor:profiles!assigned_advisor_id (id, full_name)
    `)
    .eq("travel_file_id", id)
    .order("consulted_at", { ascending: false });

  // Load activity
  const { data: rawActivity } = await supabase
    .from("travel_activity")
    .select(`
      *,
      actor_user:profiles!actor_user_id (id, full_name)
    `)
    .eq("travel_file_id", id)
    .order("created_at", { ascending: false });

  // Collect all profile IDs we need to resolve
  const profileIds = new Set<string>();
  for (const a of (rawActions as TravelAction[] | null) ?? []) {
    if (a.responsible_type === "internal" && a.responsible_user_id) profileIds.add(a.responsible_user_id);
    if (a.completed_by) profileIds.add(a.completed_by);
  }

  let profileMap: Record<string, string> = {};
  if (profileIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...profileIds]);
    profileMap = Object.fromEntries(
      (profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name])
    );
  }

  const actions = (rawActions as TravelAction[] | null) ?? [];
  const payments = (rawPayments as TravelPayment[] | null) ?? [];
  const consultations = (rawConsultations as unknown as (TravelConsultation & {
    conducted_by_profile: { id: string; full_name: string } | null;
    assigned_advisor: { id: string; full_name: string } | null;
  })[] | null) ?? [];
  const activity = (rawActivity as unknown as (TravelActivity & {
    actor_user: { id: string; full_name: string } | null;
  })[] | null) ?? [];

  // Sort actions: active/pending first, then completed
  const sortedActions = [...actions].sort((a, b) => {
    const aActive = a.status === "active" || a.status === "pending";
    const bActive = b.status === "active" || b.status === "pending";
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return 0;
  });

  const isAdmin = user.role === "admin" || user.role === "super_admin";

  const currentAction = file.current_action;
  const currentDueText = currentAction
    ? formatDueOrWaiting(currentAction.due_at, currentAction.waiting_since)
    : "—";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role} />

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Back link */}
        <Button variant="ghost" asChild className="-ml-3">
          <Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link>
        </Button>

        {/* Header */}
        <Card className="border-primary/20 shadow-md">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary">Travel File</p>
                <h1 className="text-2xl font-bold text-foreground">{file.client_name}</h1>
              </div>
              <Badge variant={formatStageBadgeVariant(file.stage)}>
                {formatStageLabel(file.stage)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoRow label="Destination" value={file.destination || "Trip details pending"} />
              <InfoRow label="Trip Type" value={file.trip_type} />
              <InfoRow
                label="Departure"
                value={file.departure_date ? formatDateOnly(file.departure_date) : "—"}
              />
              <InfoRow
                label="Return"
                value={file.return_date ? formatDateOnly(file.return_date) : "—"}
              />
              <InfoRow
                label="Assigned Advisor"
                value={file.assigned_advisor?.full_name ?? "Unassigned"}
              />
              <InfoRow label="Phase" value={<span className="capitalize">{file.phase}</span>} />
            </div>
            <div className="mt-5 flex justify-end border-t border-border pt-4">
              <TravelFileActions
                travelFileId={file.id}
                clientName={file.client_name}
                destination={file.destination}
                tripType={file.trip_type}
                travelTimeframe={file.travel_timeframe}
                departureDate={file.departure_date}
                returnDate={file.return_date}
                numberOfAdults={file.number_of_adults}
                numberOfChildren={file.number_of_children}
                childrenAges={file.children_ages}
                budgetRange={file.budget_range}
                insuranceInterest={file.insurance_interest === "yes"}
                specialConsiderations={file.special_requests}
                travelInterests={file.travel_interests ?? []}
                travelSeasons={file.travel_seasons ?? []}
                inquirySource={file.inquiry_source}
                intakeMethod={file.intake_method}
                referralDetail={file.referral_detail}
                eventDetail={file.event_detail}
                staffNotes={file.staff_notes}
                internalNotes={file.internal_notes}
                assignedAdvisorId={file.assigned_advisor_id}
                updatedAt={file.updated_at}
                proposalDueDate={file.proposal_due_date}
                dateBooked={file.date_booked}
                totalBookingValue={file.total_booking_value}
                tmfAmount={file.tmf_amount}
                ivtCustom={file.ivt_custom}
                clientbaseResCardId={file.clientbase_res_card_id}
                primaryBookingNumber={file.primary_booking_number}
                travefyProposalUrl={file.travefy_proposal_url}
                travefyTripPlanUrl={file.travefy_trip_plan_url}
                insuranceStatus={file.insurance_status}
                insuranceWaiverSigned={file.insurance_waiver_signed}
                pretripMeetingRequired={file.pretrip_meeting_required}
                pretripMeetingBookedAt={file.pretrip_meeting_booked_at}
                pretripCardSentAt={file.pretrip_card_sent_at}
                bookingRegistrationEligible={file.booking_registration_eligible}
                bookingRegistrationDoneAt={file.booking_registration_done_at}
                canEdit={user.isActive}
                canDelete={isAdmin}
                stage={file.stage}
                currentActionCode={currentAction?.action_code ?? null}
                currentActionStatus={currentAction?.status ?? null}
              />
            </div>
          </CardContent>
        </Card>

        {/* Current Action card */}
        <Card>
          <CardHeader>
            <CardTitle>Current Action</CardTitle>
          </CardHeader>
          <CardContent>
            {currentAction ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">{currentAction.title}</h3>
                  <Badge variant="secondary" className="capitalize">
                    {currentAction.action_role}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {currentAction.status}
                  </Badge>
                </div>
                {currentAction.description && (
                  <p className="text-sm text-muted-foreground">{currentAction.description}</p>
                )}
                <div className="grid gap-4 sm:grid-cols-3">
                  <InfoRow
                    label="Responsible"
                    value={getResponsibleName(currentAction, profileMap)}
                  />
                  <InfoRow
                    label="Due / Waiting"
                    value={
                      <span className={isOverdue(currentAction.due_at) ? "text-destructive font-medium" : ""}>
                        {currentDueText}
                      </span>
                    }
                  />
                  <InfoRow
                    label="Completion Source"
                    value={currentAction.completion_source ?? "—"}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No current action</p>
            )}
          </CardContent>
        </Card>

        {/* Consultation / TMF Details */}
        {file.tmf_agreement_type && (
          <Card>
            <CardHeader>
              <CardTitle>Consultation / TMF Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <InfoRow label="Client Fit" value="Yes" />
                <InfoRow
                  label="Agreement Type"
                  value={file.tmf_agreement_type === "ivt" ? "IVT" : "All-Inclusive"}
                />
                <InfoRow label="TMF Amount" value={formatCurrency(file.tmf_amount)} />
                <InfoRow
                  label="Assigned Advisor"
                  value={file.assigned_advisor?.full_name ?? "Unassigned"}
                />
                {file.tmf_agreement_type === "ivt" && (
                  <InfoRow
                    label="Revisions Included"
                    value={file.revisions_included != null ? String(file.revisions_included) : "—"}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoRow label="Stage" value={formatStageLabel(file.stage)} />
              <InfoRow
                label="Assigned Advisor"
                value={file.assigned_advisor?.full_name ?? "Unassigned"}
              />
              <InfoRow label="Inquiry Source" value={file.inquiry_source} />
              <InfoRow
                label="Inquiry Received"
                value={formatReadableDate(file.inquiry_received_at)}
              />
              <InfoRow label="Destination" value={file.destination} />
              <InfoRow label="Trip Type" value={file.trip_type} />
              <InfoRow label="Number of Travellers" value={file.number_of_travellers} />
              <InfoRow
                label="Departure Date"
                value={file.departure_date ? formatDateOnly(file.departure_date) : "—"}
              />
              <InfoRow
                label="Return Date"
                value={file.return_date ? formatDateOnly(file.return_date) : "—"}
              />
              <InfoRow label="Budget Range" value={file.budget_range} />
              <InfoRow label="TMF Amount" value={formatCurrency(file.tmf_amount)} />
              <InfoRow label="IVT / Custom" value={formatBoolean(file.ivt_custom)} />
              <InfoRow
                label="Proposal Due Date"
                value={file.proposal_due_date ? formatDateOnly(file.proposal_due_date) : "—"}
              />
              <InfoRow
                label="Date Booked"
                value={file.date_booked ? formatDateOnly(file.date_booked) : "—"}
              />
              <InfoRow
                label="Total Booking Value"
                value={formatCurrency(file.total_booking_value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Inquiry Details */}
        <Card>
          <CardHeader>
            <CardTitle>Inquiry Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="Travel Timeframe" value={file.travel_timeframe} />
              <InfoRow label="Adults" value={file.number_of_adults} />
              <InfoRow label="Children" value={file.number_of_children} />
              <InfoRow label="Ages of Children" value={file.children_ages} />
              <InfoRow label="Travel Budget" value={file.budget_range} />
              <InfoRow label="Insurance Interest" value={file.insurance_interest} />
              <div className="sm:col-span-2 lg:col-span-3">
                <InfoRow label="Special Considerations" value={file.special_requests} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking References */}
        <Card>
          <CardHeader>
            <CardTitle>Booking References</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="ClientBase Res Card ID" value={file.clientbase_res_card_id} />
              <InfoRow label="Primary Booking Number" value={file.primary_booking_number} />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Travefy Proposal URL</span>
                {file.travefy_proposal_url ? (
                  <a
                    href={file.travefy_proposal_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline break-all"
                  >
                    {file.travefy_proposal_url}
                  </a>
                ) : (
                  <span className="text-sm font-medium text-foreground">—</span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Travefy Trip Plan URL</span>
                {file.travefy_trip_plan_url ? (
                  <a
                    href={file.travefy_trip_plan_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline break-all"
                  >
                    {file.travefy_trip_plan_url}
                  </a>
                ) : (
                  <span className="text-sm font-medium text-foreground">—</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insurance / Pre-Trip */}
        <Card>
          <CardHeader>
            <CardTitle>Insurance / Pre-Trip</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoRow label="Insurance Status" value={<span className="capitalize">{file.insurance_status}</span>} />
              <InfoRow label="Waiver Signed" value={formatBoolean(file.insurance_waiver_signed)} />
              <InfoRow
                label="Pre-Trip Meeting Required"
                value={formatBoolean(file.pretrip_meeting_required)}
              />
              <InfoRow
                label="Pre-Trip Meeting Booked"
                value={file.pretrip_meeting_booked_at ? formatReadableDateTime(file.pretrip_meeting_booked_at) : "—"}
              />
              <InfoRow
                label="Pre-Trip Card Sent"
                value={file.pretrip_card_sent_at ? formatReadableDateTime(file.pretrip_card_sent_at) : "—"}
              />
              <InfoRow
                label="Booking Registration Eligible"
                value={formatBoolean(file.booking_registration_eligible)}
              />
              <InfoRow
                label="Booking Registration Completed"
                value={file.booking_registration_done_at ? formatReadableDateTime(file.booking_registration_done_at) : "—"}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedActions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No actions recorded.</p>
            ) : (
              <div className="divide-y divide-border">
                {sortedActions.map((action) => (
                  <div key={action.id} className="py-3 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{action.title}</span>
                      <Badge variant="outline" className="capitalize">{action.action_role}</Badge>
                      <Badge variant="secondary" className="capitalize">{action.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Responsible: {getResponsibleName(action, profileMap)}</span>
                      <span>
                        Due/Waiting: {formatDueOrWaiting(action.due_at, action.waiting_since)}
                      </span>
                      {action.completed_at && (
                        <span>Completed: {formatReadableDateTime(action.completed_at)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No payments recorded.</p>
            ) : (
              <div className="divide-y divide-border">
                {payments.map((payment) => (
                  <div key={payment.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground capitalize">{payment.payment_type}</span>
                        {payment.description && (
                          <span className="text-sm text-muted-foreground">{payment.description}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Due: {formatDateOnly(payment.due_date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-foreground">
                        {formatCurrency(payment.amount)}
                      </span>
                      <Badge variant="outline" className="capitalize">{payment.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Consultations */}
        <Card>
          <CardHeader>
            <CardTitle>Consultations</CardTitle>
          </CardHeader>
          <CardContent>
            {consultations.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No consultations recorded.</p>
            ) : (
              <div className="divide-y divide-border">
                {consultations.map((c) => (
                  <div key={c.id} className="py-3 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">
                        {formatReadableDate(c.consulted_at)}
                      </span>
                      <Badge variant="secondary" className="capitalize">
                        {c.outcome.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        by {c.conducted_by_profile?.full_name ?? "Unknown"}
                      </span>
                    </div>
                    {c.discussion_summary && (
                      <p className="text-sm text-muted-foreground">{c.discussion_summary}</p>
                    )}
                    {c.recommendations && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Recommendations:</span> {c.recommendations}
                      </p>
                    )}
                    {c.next_steps && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Next steps:</span> {c.next_steps}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No activity recorded.</p>
            ) : (
              <div className="divide-y divide-border">
                {activity.map((a) => (
                  <div key={a.id} className="py-3 flex items-start gap-3">
                    <div className="flex-1 space-y-0.5">
                      <p className="text-sm text-foreground">{a.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatReadableDateTime(a.created_at)}
                        {a.actor_user && ` · ${a.actor_user.full_name}`}
                        {!a.actor_user && a.actor_type !== "system" && ` · ${a.actor_type}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <SharedFooter maxWidth="max-w-4xl" label="Travel File" />
    </div>
  );
}
