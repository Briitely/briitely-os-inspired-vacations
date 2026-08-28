import "server-only";

import { createClient } from "@/lib/supabase/server";
import { upsertContact, findContactByEmailOrPhone, addContactTag } from "@/lib/briitely/contacts";
import { briitelyRequest } from "@/lib/briitely/client";
import {
  travelInterestOptions,
  travelSeasonOptions,
  referralSourceOptions,
  resolveTagsFromSelections,
  NEW_INQUIRY_TAG,
} from "./tag-mappings";

// ── Public types ─────────────────────────────────────────────

export interface IntakeInput {
  // Contact details
  firstName: string;
  lastName: string;
  email: string;
  phone: string;

  // Trip details
  destination: string;
  tripType: string;
  travelTimeframe: string;
  budgetRange: string;
  numberOfAdults: number;
  numberOfChildren: number | null;
  childrenAges: string | null;

  // Travel profile / interests
  travelInterests: string[];
  travelSeasons: string[];

  // Optional profile context
  lastTravelDestination: string | null;
  lastTravelDate: string | null;

  // Referral / source
  referralSource: string;
  referralDetail: string | null;
  eventDetail: string | null;

  // Other
  specialConsiderations: string | null;
  consent: boolean;

  // Intake metadata
  intakeSource: "website" | "staff";
  intakeMethod: string;
  staffNotes: string | null;
  staffUserId: string | null;
}

export interface IntakeResult {
  success: boolean;
  travelFileId: string | null;
  briitelyContactId: string | null;
  error: string | null;
  briitelySyncPending: boolean;
}

// ── Config: default inquiry owner ────────────────────────────

interface DefaultInquiryOwner {
  portalProfileId: string;
  briitelyUserId: string;
}

async function getDefaultInquiryOwner(): Promise<DefaultInquiryOwner> {
  const portalProfileId = process.env.DEFAULT_INQUIRY_OWNER_PROFILE_ID ?? "";
  let briitelyUserId = "";

  if (portalProfileId) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("ghl_user_id")
      .eq("id", portalProfileId)
      .maybeSingle();

    if (profile?.ghl_user_id) {
      briitelyUserId = profile.ghl_user_id;
    } else {
      console.warn("INTAKE_CONFIG", {
        warning: "DEFAULT_INQUIRY_OWNER_PROFILE_ID is set but the profile has no ghl_user_id — Briitely contact assignment will be skipped",
        profileId: portalProfileId,
      });
    }
  }

  return { portalProfileId, briitelyUserId };
}

// ── Validation ──────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateIntake(input: IntakeInput): ValidationResult {
  const errors: string[] = [];

  if (!input.firstName.trim()) errors.push("First name is required.");
  if (!input.lastName.trim()) errors.push("Last name is required.");
  if (!input.email.trim()) errors.push("Email is required.");
  if (!input.phone.trim()) errors.push("Phone is required.");
  if (!input.destination.trim()) errors.push("Destination is required.");
  if (!input.tripType.trim()) errors.push("Trip type is required.");
  if (!input.travelTimeframe.trim()) errors.push("Travel timeframe is required.");
  if (!input.budgetRange.trim()) errors.push("Budget range is required.");
  if (!input.referralSource.trim()) errors.push("How did you hear about us is required.");
  if (!input.consent) errors.push("Consent is required.");

  const adults = input.numberOfAdults;
  if (typeof adults !== "number" || !Number.isFinite(adults) || adults < 1) {
    errors.push("At least one adult is required.");
  }

  if (input.numberOfChildren !== null && input.numberOfChildren < 0) {
    errors.push("Number of children cannot be negative.");
  }

  if (input.numberOfChildren !== null && input.numberOfChildren > 0) {
    if (!input.childrenAges || !input.childrenAges.trim()) {
      errors.push("Ages of children is required when number of children is greater than zero.");
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Traveller count ──────────────────────────────────────────

export function calculateTravellerCount(adults: number, children: number | null): number {
  return adults + (children ?? 0);
}

// ── Tag resolution ───────────────────────────────────────────

export function resolveIntakeTags(input: IntakeInput): string[] {
  const interestTags = resolveTagsFromSelections(travelInterestOptions, input.travelInterests);
  const seasonTags = resolveTagsFromSelections(travelSeasonOptions, input.travelSeasons);
  const sourceTags = resolveTagsFromSelections(referralSourceOptions, [input.referralSource]);
  return [...interestTags, ...seasonTags, ...sourceTags];
}

// ── Main intake service ─────────────────────────────────────

export async function processIntake(input: IntakeInput): Promise<IntakeResult> {
  const supabase = await createClient();
  const owner = await getDefaultInquiryOwner();
  const numberOfChildren = input.numberOfChildren ?? 0;
  const numberOfTravellers = calculateTravellerCount(input.numberOfAdults, numberOfChildren);
  const clientName = `${input.firstName} ${input.lastName}`.trim();

  // 1. Resolve or create Briitely contact FIRST so we have a contact ID
  let briitelyContactId: string | null = null;
  let briitelySyncPending = false;
  let briitelySyncError: string | null = null;

  try {
    const existing = await findContactByEmailOrPhone(input.email, input.phone);
    if (existing) {
      const updated = await upsertContact({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
      });
      briitelyContactId = updated.customer.id;
    } else {
      const created = await upsertContact({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
      });
      briitelyContactId = created.customer.id;
    }
  } catch (err) {
    console.error("INTAKE_BRIITELY_CONTACT_FAILED", {
      email: input.email,
      error: err instanceof Error ? err.message : "unknown",
    });
    briitelySyncPending = true;
    briitelySyncError = "Contact create/update failed.";
  }

  // 2. Create Travel File in Supabase
  const { data: travelFile, error: fileError } = await supabase
    .from("travel_files")
    .insert({
      briitely_contact_id: briitelyContactId ?? "pending",
      client_name: clientName,
      file_status: "open",
      phase: "lead",
      stage: "new_inquiry",
      inquiry_source: input.intakeSource,
      intake_method: input.intakeMethod,
      assigned_advisor_id: owner.portalProfileId || null,
      destination: input.destination,
      trip_type: input.tripType,
      travel_timeframe: input.travelTimeframe,
      budget_range: input.budgetRange,
      number_of_adults: input.numberOfAdults,
      number_of_children: numberOfChildren,
      number_of_travellers: numberOfTravellers,
      children_ages: input.childrenAges,
      travel_interests: input.travelInterests.length > 0 ? input.travelInterests : null,
      travel_seasons: input.travelSeasons.length > 0 ? input.travelSeasons : null,
      referral_detail: input.referralDetail,
      event_detail: input.eventDetail,
      insurance_interest: "no",
      special_requests: input.specialConsiderations,
      staff_notes: input.staffNotes,
      briitely_sync_status: briitelySyncPending ? "pending" : "synced",
      briitely_sync_error: briitelySyncError,
      briitely_last_synced_at: briitelySyncPending ? null : new Date().toISOString(),
    })
    .select("id")
    .single();

  if (fileError || !travelFile) {
    console.error("INTAKE_TRAVEL_FILE_CREATE_FAILED", {
      error: fileError?.message ?? "unknown",
    });
    return {
      success: false,
      travelFileId: null,
      briitelyContactId,
      error: "We couldn't create your travel request. Please try again or contact us.",
      briitelySyncPending: false,
    };
  }

  const travelFileId = travelFile.id;

  // 3. Create initial Travel Action
  const { data: action, error: actionError } = await supabase
    .from("travel_actions")
    .insert({
      travel_file_id: travelFileId,
      action_code: "book_initial_consultation",
      title: "Book initial consultation",
      action_role: "blocking",
      responsible_type: "client",
      status: "active",
      waiting_since: new Date().toISOString(),
      due_at: null,
    })
    .select("id")
    .single();

  if (action && !actionError) {
    await supabase
      .from("travel_files")
      .update({ current_action_id: action.id })
      .eq("id", travelFileId);
  }

  // 4. Create activity entries
  const activities = [
    {
      travel_file_id: travelFileId,
      event_type: "inquiry_received",
      summary: "Inquiry received. Travel File created.",
      actor_type: input.intakeSource === "staff" ? "internal" : "system",
      actor_user_id: input.staffUserId,
    },
    {
      travel_file_id: travelFileId,
      event_type: "action_created",
      summary: "Client responsible for booking initial consultation.",
      actor_type: "system" as const,
    },
  ];

  if (input.intakeSource === "staff") {
    activities.push({
      travel_file_id: travelFileId,
      event_type: "staff_intake",
      summary: "Inquiry entered by staff.",
      actor_type: "internal" as const,
      actor_user_id: input.staffUserId,
    });
  }

  for (const act of activities) {
    await supabase.from("travel_activity").insert(act);
  }

  // 5. If Briitely contact failed, return sync-pending result
  if (briitelySyncPending || !briitelyContactId) {
    return {
      success: true,
      travelFileId,
      briitelyContactId: null,
      error: null,
      briitelySyncPending: true,
    };
  }

  // 6. Assign Tracy as contact owner in Briitely
  if (owner.briitelyUserId) {
    try {
      await briitelyRequest({
        method: "PUT",
        path: `/contacts/${encodeURIComponent(briitelyContactId)}`,
        body: { assignedTo: owner.briitelyUserId },
      });
    } catch (err) {
      console.error("INTAKE_BRIITELY_ASSIGN_FAILED", {
        contactId: briitelyContactId,
        error: err instanceof Error ? err.message : "unknown",
      });
      // Non-fatal: contact exists, assignment can be retried
    }
  }

  // 7. Apply persistent segmentation tags (interests, seasons, source)
  const interestTags = resolveTagsFromSelections(travelInterestOptions, input.travelInterests);
  const seasonTags = resolveTagsFromSelections(travelSeasonOptions, input.travelSeasons);
  const sourceTags = resolveTagsFromSelections(referralSourceOptions, [input.referralSource]);
  const persistentTags = [...interestTags, ...seasonTags, ...sourceTags];

  let persistentTagWriteAttempted = false;
  let persistentTagWriteSucceeded = true;
  let persistentTagWriteHttpStatus: number | null = null;
  let persistentTagErrorStage: string | null = null;

  for (const tag of persistentTags) {
    persistentTagWriteAttempted = true;
    try {
      const result = await addContactTag(briitelyContactId, tag);
      if (!result.succeeded) {
        console.error("INTAKE_TAG_APPLICATION_FAILED", { tag, contactId: briitelyContactId, result });
        persistentTagWriteSucceeded = false;
        persistentTagWriteHttpStatus = result.httpStatus;
        persistentTagErrorStage = result.errorStage ?? "tag_not_confirmed";
      } else if (persistentTagWriteHttpStatus === null) {
        persistentTagWriteHttpStatus = result.httpStatus;
      }
    } catch (err) {
      console.error("INTAKE_TAG_APPLICATION_ERROR", {
        tag,
        contactId: briitelyContactId,
        error: err instanceof Error ? err.message : "unknown",
      });
      persistentTagWriteSucceeded = false;
      persistentTagErrorStage = "exception";
    }
  }

  console.info("PORTAL_INTAKE_TAG_SYNC", {
    briitelyContactId,
    interestTags,
    seasonTags,
    sourceTags,
    persistentTagList: persistentTags,
    persistentTagWriteAttempted,
    persistentTagWriteSucceeded,
    persistentTagWriteHttpStatus,
    persistentTagErrorStage,
    newInquiryTagAttempted: false,
    newInquiryTagHTTPStatus: null,
    newInquiryTagSucceeded: false,
    errorStage: persistentTagErrorStage,
    errorMessage: null,
  });

  // 8. If persistent tags failed, do NOT add new-inquiry
  if (!persistentTagWriteSucceeded) {
    await supabase
      .from("travel_files")
      .update({
        briitely_sync_status: "pending",
        briitely_sync_error: "One or more segmentation tags failed to apply.",
      })
      .eq("id", travelFileId);
    return {
      success: true,
      travelFileId,
      briitelyContactId,
      error: null,
      briitelySyncPending: true,
    };
  }

  // 9. Add new-inquiry tag LAST (only after all persistent tags succeeded)
  let newInquiryTagAttempted = true;
  let newInquiryTagSucceeded = false;
  let newInquiryTagHttpStatus: number | null = null;
  let newInquiryErrorStage: string | null = null;

  try {
    const newInquiryResult = await addContactTag(briitelyContactId, NEW_INQUIRY_TAG);
    newInquiryTagHttpStatus = newInquiryResult.httpStatus;
    newInquiryTagSucceeded = newInquiryResult.succeeded;
    newInquiryErrorStage = newInquiryResult.errorStage;

    if (!newInquiryResult.succeeded) {
      console.error("INTAKE_NEW_INQUIRY_TAG_FAILED", { contactId: briitelyContactId, result: newInquiryResult });
      await supabase
        .from("travel_files")
        .update({
          briitely_sync_status: "pending",
          briitely_sync_error: "new-inquiry tag application failed.",
        })
        .eq("id", travelFileId);
      console.info("PORTAL_INTAKE_TAG_SYNC", {
        briitelyContactId,
        interestTags,
        seasonTags,
        sourceTags,
        persistentTagList: persistentTags,
        persistentTagWriteAttempted,
        persistentTagWriteSucceeded,
        persistentTagWriteHttpStatus,
        persistentTagErrorStage,
        newInquiryTagAttempted,
        newInquiryTagHTTPStatus: newInquiryTagHttpStatus,
        newInquiryTagSucceeded,
        errorStage: newInquiryErrorStage,
        errorMessage: "new-inquiry tag not confirmed",
      });
      return {
        success: true,
        travelFileId,
        briitelyContactId,
        error: null,
        briitelySyncPending: true,
      };
    }
  } catch (err) {
    console.error("INTAKE_NEW_INQUIRY_TAG_ERROR", {
      contactId: briitelyContactId,
      error: err instanceof Error ? err.message : "unknown",
    });
    newInquiryErrorStage = "exception";
    await supabase
      .from("travel_files")
      .update({
        briitely_sync_status: "pending",
        briitely_sync_error: "new-inquiry tag application error.",
      })
      .eq("id", travelFileId);
    console.info("PORTAL_INTAKE_TAG_SYNC", {
      briitelyContactId,
      interestTags,
      seasonTags,
      sourceTags,
      persistentTagList: persistentTags,
      persistentTagWriteAttempted,
      persistentTagWriteSucceeded,
      persistentTagWriteHttpStatus,
      persistentTagErrorStage,
      newInquiryTagAttempted,
      newInquiryTagHTTPStatus: null,
      newInquiryTagSucceeded: false,
      errorStage: newInquiryErrorStage,
      errorMessage: err instanceof Error ? err.message : "unknown",
    });
    return {
      success: true,
      travelFileId,
      briitelyContactId,
      error: null,
      briitelySyncPending: true,
    };
  }

  // 10. Update Travel File with confirmed Briitely contact ID and sync status
  await supabase
    .from("travel_files")
    .update({
      briitely_contact_id: briitelyContactId,
      briitely_sync_status: "synced",
      briitely_sync_error: null,
      briitely_last_synced_at: new Date().toISOString(),
    })
    .eq("id", travelFileId);

  console.info("PORTAL_INTAKE_TAG_SYNC", {
    briitelyContactId,
    interestTags,
    seasonTags,
    sourceTags,
    persistentTagList: persistentTags,
    persistentTagWriteAttempted,
    persistentTagWriteSucceeded,
    persistentTagWriteHttpStatus,
    persistentTagErrorStage,
    newInquiryTagAttempted,
    newInquiryTagHTTPStatus: newInquiryTagHttpStatus,
    newInquiryTagSucceeded,
    errorStage: null,
    errorMessage: null,
  });

  console.info("INTAKE_COMPLETED", {
    travelFileId,
    briitelyContactId,
    numberOfTravellers,
    persistentTagsApplied: persistentTags.length,
    newInquiryAdded: true,
  });

  return {
    success: true,
    travelFileId,
    briitelyContactId,
    error: null,
    briitelySyncPending: false,
  };
}
