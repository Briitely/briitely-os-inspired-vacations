import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

interface CreateRequestBody {
  briitelyContactId: string;
  clientName: string;
  inquirySource: string;
  destination?: string;
  tripType?: string;
  departureDate?: string;
  returnDate?: string;
  numberOfTravellers?: number;
  budgetRange?: string;
  assignedAdvisorId?: string;
  notes?: string;
}

const VALID_SOURCES = ["web", "email", "phone", "referral", "repeat_client", "other"];

export async function POST(request: Request) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json()) as Partial<CreateRequestBody>;
  const {
    briitelyContactId,
    clientName,
    inquirySource,
    destination,
    tripType,
    departureDate,
    returnDate,
    numberOfTravellers,
    budgetRange,
    assignedAdvisorId,
    notes,
  } = body;

  if (!briitelyContactId) {
    return NextResponse.json({ error: "Customer is required." }, { status: 400 });
  }
  if (!clientName || !clientName.trim()) {
    return NextResponse.json({ error: "Client name is required." }, { status: 400 });
  }
  if (!inquirySource || !VALID_SOURCES.includes(inquirySource)) {
    return NextResponse.json({ error: "A valid inquiry source is required." }, { status: 400 });
  }
  if (numberOfTravellers !== undefined && (isNaN(numberOfTravellers) || numberOfTravellers <= 0)) {
    return NextResponse.json({ error: "Number of travellers must be greater than 0." }, { status: 400 });
  }
  if (departureDate && returnDate && new Date(returnDate) < new Date(departureDate)) {
    return NextResponse.json({ error: "Return date cannot be before departure date." }, { status: 400 });
  }

  const supabase = await createClient();

  // Step 1: Create the Travel File
  const fileInsert: Record<string, unknown> = {
    briitely_contact_id: briitelyContactId,
    client_name: clientName.trim(),
    file_status: "open",
    phase: "lead",
    stage: "new_inquiry",
    inquiry_source: inquirySource,
  };

  if (destination?.trim()) fileInsert.destination = destination.trim();
  if (tripType) fileInsert.trip_type = tripType;
  if (departureDate) fileInsert.departure_date = departureDate;
  if (returnDate) fileInsert.return_date = returnDate;
  if (numberOfTravellers) fileInsert.number_of_travellers = numberOfTravellers;
  if (budgetRange?.trim()) fileInsert.budget_range = budgetRange.trim();
  if (assignedAdvisorId) fileInsert.assigned_advisor_id = assignedAdvisorId;
  if (notes?.trim()) fileInsert.internal_notes = notes.trim();

  const { data: file, error: fileError } = await supabase
    .from("travel_files")
    .insert(fileInsert)
    .select()
    .single();

  if (fileError || !file) {
    return NextResponse.json(
      { error: "Failed to create Travel File.", detail: fileError?.message },
      { status: 500 }
    );
  }

  // Step 2: Create the initial blocking action
  const { data: action, error: actionError } = await supabase
    .from("travel_actions")
    .insert({
      travel_file_id: file.id,
      action_code: "book_initial_consultation",
      title: "Book initial consultation",
      action_role: "blocking",
      responsible_type: "client",
      status: "active",
      waiting_since: new Date().toISOString(),
    })
    .select()
    .single();

  if (actionError || !action) {
    await supabase.from("travel_files").delete().eq("id", file.id);
    return NextResponse.json(
      { error: "Failed to create initial action.", detail: actionError?.message },
      { status: 500 }
    );
  }

  // Step 3: Link current_action_id
  const { error: linkError } = await supabase
    .from("travel_files")
    .update({ current_action_id: action.id })
    .eq("id", file.id);

  if (linkError) {
    await supabase.from("travel_actions").delete().eq("id", action.id);
    await supabase.from("travel_files").delete().eq("id", file.id);
    return NextResponse.json(
      { error: "Failed to link current action.", detail: linkError.message },
      { status: 500 }
    );
  }

  // Step 4: Create activity records
  await supabase.from("travel_activity").insert([
    {
      travel_file_id: file.id,
      event_type: "travel_file_created",
      summary: "Travel File created",
      actor_type: "internal",
      actor_user_id: user.id,
      new_stage: "new_inquiry",
      metadata: { inquiry_source: inquirySource },
    },
    {
      travel_file_id: file.id,
      event_type: "action_created",
      summary: "Client responsible for booking initial consultation",
      actor_type: "system",
      action_id: action.id,
      metadata: { action_code: "book_initial_consultation" },
    },
  ]);

  return NextResponse.json({ travelFileId: file.id, actionId: action.id });
}
