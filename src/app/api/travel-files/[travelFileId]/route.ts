import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ travelFileId: string }> }
) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (user.role !== "admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { travelFileId } = await params;
  const supabase = await createClient();

  // Verify this is a test file before allowing deletion
  const { data: file, error: fetchError } = await supabase
    .from("travel_files")
    .select("briitely_contact_id")
    .eq("id", travelFileId)
    .maybeSingle();

  if (fetchError || !file) {
    return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  }

  if (file.briitely_contact_id !== "test-contact") {
    return NextResponse.json(
      { error: "Only test Travel Files can be deleted." },
      { status: 403 }
    );
  }

  // Delete the travel file — cascade rules handle actions, requirements, payments, etc.
  const { error: deleteError } = await supabase
    .from("travel_files")
    .delete()
    .eq("id", travelFileId);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete Travel File.", detail: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
