import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getBookingFormSession } from "@/lib/travel/booking-form";

const PERMANENT_RELATIONSHIPS = new Set(["spouse_partner", "child", "adult_child", "parent", "other_family"]);
const VALID_RELATIONSHIPS = new Set(["spouse_partner", "child", "adult_child", "parent", "other_family", "travel_companion"]);
const DUPLICATE_REVIEW_CODE = "check_client_added_traveller_duplicates";
const DUPLICATE_REVIEW_TITLE = "Check for duplicate traveller files";
const DUPLICATE_REVIEW_NOTES = "Client added a traveller from the booking form. Search for an existing client or traveller profile and connect the records if a match exists.";

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function profileOf(member: any) {
  return Array.isArray(member?.traveller_profiles) ? member.traveller_profiles[0] : member?.traveller_profiles;
}

async function ensureDuplicateTravellerReviewTask(db: any, travelFileId: string) {
  try {
    const { data: file, error: fileError } = await db
      .from("travel_files")
      .select("assigned_advisor_id,current_action_id")
      .eq("id", travelFileId)
      .maybeSingle();

    if (fileError || !file) {
      if (fileError) console.error("CLIENT_ADDED_TRAVELLER_FILE_LOOKUP_FAILED", fileError);
      return;
    }

    // Always create the master review task, regardless of the Travel File's current stage/action.
    const { data: existingTask, error: taskLookupError } = await db
      .from("travel_file_tasks")
      .select("id,status,assigned_to")
      .eq("travel_file_id", travelFileId)
      .eq("title", DUPLICATE_REVIEW_TITLE)
      .neq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (taskLookupError) console.error("CLIENT_ADDED_TRAVELLER_TASK_LOOKUP_FAILED", taskLookupError);

    if (existingTask) {
      if (existingTask.assigned_to !== (file.assigned_advisor_id ?? null)) {
        const { error: assignmentError } = await db.from("travel_file_tasks").update({
          assigned_to: file.assigned_advisor_id ?? null,
          updated_at: new Date().toISOString(),
        }).eq("id", existingTask.id);
        if (assignmentError) console.error("CLIENT_ADDED_TRAVELLER_TASK_ASSIGNMENT_FAILED", assignmentError);
      }
    } else {
      const { error: taskError } = await db.from("travel_file_tasks").insert({
        travel_file_id: travelFileId,
        title: DUPLICATE_REVIEW_TITLE,
        notes: DUPLICATE_REVIEW_NOTES,
        assigned_to: file.assigned_advisor_id ?? null,
        due_date: null,
        status: "todo",
        task_context: "travel_file",
        created_by: null,
      });
      if (taskError) console.error("CLIENT_ADDED_TRAVELLER_MASTER_TASK_FAILED", taskError);
    }

    // When the file happens to be in the original retainer/booking-form action,
    // keep the existing action checklist item too. Other stages rely on the master task only.
    if (!file.current_action_id) return;

    const { data: action } = await db
      .from("travel_actions")
      .select("id,action_code,status")
      .eq("id", file.current_action_id)
      .maybeSingle();

    if (action?.action_code !== "await_tmf_and_booking_form" || action?.status !== "active") return;

    const { data: existingRequirement } = await db
      .from("travel_action_requirements")
      .select("id,status")
      .eq("travel_action_id", action.id)
      .eq("requirement_code", DUPLICATE_REVIEW_CODE)
      .maybeSingle();

    if (!existingRequirement) {
      const { error: requirementError } = await db.from("travel_action_requirements").insert({
        travel_action_id: action.id,
        requirement_code: DUPLICATE_REVIEW_CODE,
        label: DUPLICATE_REVIEW_TITLE,
        requirement_label: DUPLICATE_REVIEW_TITLE,
        status: "pending",
      });
      if (requirementError) console.error("CLIENT_ADDED_TRAVELLER_CHECKLIST_TASK_FAILED", requirementError);
    } else if (existingRequirement.status === "complete") {
      const { error: reopenError } = await db.from("travel_action_requirements").update({
        status: "pending",
        completed_at: null,
        completed_by: null,
      }).eq("id", existingRequirement.id);
      if (reopenError) console.error("CLIENT_ADDED_TRAVELLER_CHECKLIST_REOPEN_FAILED", reopenError);
    }
  } catch (error) {
    // Never block the client's booking form because an internal follow-up task could not be created.
    console.error("CLIENT_ADDED_TRAVELLER_TASK_SETUP_FAILED", error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const session = await getBookingFormSession(token);
    if (!session) return NextResponse.json({ error: "This booking form link is invalid or has expired." }, { status: 404 });
    if (session.completed_at) return NextResponse.json({ error: "This booking form has already been submitted." }, { status: 409 });

    const db = createServiceClient();
    if (!db) return NextResponse.json({ error: "Booking form is unavailable." }, { status: 500 });

    if (session.include_retainer) {
      const { data: acceptance } = await db.from("retainer_acceptances").select("id").eq("booking_form_session_id", session.id).maybeSingle();
      if (!acceptance) return NextResponse.json({ error: "Please accept the Retainer Agreement before adding travellers." }, { status: 400 });
    }

    const body = await req.json().catch(() => null) as {
      firstName?: string;
      middleName?: string;
      lastName?: string;
      preferredName?: string;
      dateOfBirth?: string;
      relationshipToFormContact?: string;
    } | null;

    const firstName = text(body?.firstName);
    const lastName = text(body?.lastName);
    const dateOfBirth = text(body?.dateOfBirth);
    const relationship = text(body?.relationshipToFormContact) ?? "travel_companion";

    if (!firstName || !lastName || !dateOfBirth) {
      return NextResponse.json({ error: "Legal first name, last name, and date of birth are required." }, { status: 400 });
    }
    if (!VALID_RELATIONSHIPS.has(relationship)) {
      return NextResponse.json({ error: "Choose a valid relationship." }, { status: 400 });
    }

    const { data: party, error: partyError } = await db
      .from("travel_file_travellers")
      .select("id, traveller_role, traveller_profile_id, booking_form_recipient_party_member_id, traveller_profiles:traveller_profile_id(id,briitely_contact_id,first_name,last_name)")
      .eq("travel_file_id", session.travel_file_id)
      .order("created_at", { ascending: true });
    if (partyError) return NextResponse.json({ error: partyError.message }, { status: 500 });

    const formRecipient = session.recipient_party_member_id
      ? (party ?? []).find((member: any) => member.id === session.recipient_party_member_id)
      : (party ?? []).find((member: any) => member.traveller_role === "primary");
    if (!formRecipient) return NextResponse.json({ error: "Booking form recipient could not be identified." }, { status: 400 });

    const { data: profile, error: profileError } = await db.from("traveller_profiles").insert({
      first_name: firstName,
      middle_name: text(body?.middleName),
      last_name: lastName,
      preferred_name: text(body?.preferredName),
      date_of_birth: dateOfBirth,
    }).select("id, first_name, middle_name, last_name, preferred_name, date_of_birth, email, phone, address_line_1, address_line_2, city, province_state, postal_zip, country, passport_number, passport_country, passport_issue_date, passport_expiry_date").single();
    if (profileError || !profile) return NextResponse.json({ error: profileError?.message ?? "Could not create traveller." }, { status: 500 });

    const { data: member, error: memberError } = await db.from("travel_file_travellers").insert({
      travel_file_id: session.travel_file_id,
      traveller_profile_id: profile.id,
      traveller_role: "traveller",
      relationship_to_primary: relationship,
      receive_trip_communications: false,
      booking_form_required: false,
      booking_form_recipient_party_member_id: session.recipient_party_member_id ?? null,
    }).select("id, traveller_role, relationship_to_primary, receive_trip_communications, booking_form_required, booking_form_recipient_party_member_id").single();
    if (memberError || !member) {
      await db.from("traveller_profiles").delete().eq("id", profile.id);
      return NextResponse.json({ error: memberError?.message ?? "Could not add traveller to this trip." }, { status: 500 });
    }

    const recipientProfile = profileOf(formRecipient);
    if (recipientProfile?.briitely_contact_id && PERMANENT_RELATIONSHIPS.has(relationship)) {
      await db.from("client_relationships").upsert({
        primary_contact_id: recipientProfile.briitely_contact_id,
        related_traveller_id: profile.id,
        relationship_type: relationship,
      }, { onConflict: "primary_contact_id,related_traveller_id" });
    }

    // Persist provenance independently of workflow stage so the staff Travel Party
    // can reliably identify exactly which traveller was added by the client.
    const { error: activityError } = await db.from("travel_activity").insert({
      travel_file_id: session.travel_file_id,
      event_type: "client_added_traveller",
      summary: `Client added traveller ${[profile.preferred_name || profile.first_name, profile.last_name].filter(Boolean).join(" ")} from the booking form.`,
      actor_type: "client",
      metadata: {
        party_member_id: member.id,
        traveller_profile_id: profile.id,
        booking_form_session_id: session.id,
      },
    });
    if (activityError) console.error("CLIENT_ADDED_TRAVELLER_ACTIVITY_FAILED", activityError);

    await ensureDuplicateTravellerReviewTask(db, session.travel_file_id);

    return NextResponse.json({
      traveller: {
        ...member,
        traveller_profiles: profile,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("PUBLIC_BOOKING_ADD_TRAVELLER_FAILED", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add traveller." }, { status: 500 });
  }
}
