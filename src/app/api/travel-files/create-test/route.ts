import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (user.role !== "admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const supabase = await createClient();

  // Step 1: Create the Travel File
  const { data: file, error: fileError } = await supabase
    .from("travel_files")
    .insert({
      client_name: "Test Travel File",
      briitely_contact_id: "test-contact",
      phase: "lead",
      stage: "new_inquiry",
      file_status: "open",
      destination: "Test Destination",
      inquiry_source: "other",
    })
    .select()
    .single();

  if (fileError || !file) {
    return NextResponse.json(
      { error: "Failed to create Travel File.", detail: fileError?.message },
      { status: 500 }
    );
  }

  // Step 2: Create a Travel Action
  const { data: action, error: actionError } = await supabase
    .from("travel_actions")
    .insert({
      travel_file_id: file.id,
      action_code: "book_consult",
      title: "Book initial consultation",
      action_role: "blocking",
      responsible_type: "client",
      status: "active",
      waiting_since: new Date().toISOString(),
    })
    .select()
    .single();

  if (actionError || !action) {
    // Cleanup the file if action creation failed
    await supabase.from("travel_files").delete().eq("id", file.id);
    return NextResponse.json(
      { error: "Failed to create Travel Action.", detail: actionError?.message },
      { status: 500 }
    );
  }

  // Step 3: Set current_action_id on the Travel File
  const { error: linkError } = await supabase
    .from("travel_files")
    .update({ current_action_id: action.id })
    .eq("id", file.id);

  if (linkError) {
    // Cleanup
    await supabase.from("travel_actions").delete().eq("id", action.id);
    await supabase.from("travel_files").delete().eq("id", file.id);
    return NextResponse.json(
      { error: "Failed to link current action.", detail: linkError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ travelFileId: file.id, actionId: action.id });
}
