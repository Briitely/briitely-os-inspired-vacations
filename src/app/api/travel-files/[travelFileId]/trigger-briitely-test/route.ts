import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { addContactTag } from "@/lib/briitely/contacts";

const TEST_TAG = "portal-test-inquiry-received";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ travelFileId: string }> }
) {
  const adminCheck = await requireAdmin();
  if (!adminCheck) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { travelFileId } = await params;
  const supabase = await createClient();

  const { data: file, error: fileError } = await supabase
    .from("travel_files")
    .select("id, briitely_contact_id")
    .eq("id", travelFileId)
    .maybeSingle();

  if (fileError || !file) {
    console.info("PORTAL_BRIITELY_TEST_TRIGGER", {
      travelFileId,
      contactIdPresent: false,
      tagAddAttempted: false,
      tagAddSucceeded: false,
      briitelyHttpStatus: null,
      errorStage: "travel_file_not_found",
    });
    return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  }

  const contactId = file.briitely_contact_id;
  if (!contactId) {
    console.info("PORTAL_BRIITELY_TEST_TRIGGER", {
      travelFileId,
      contactIdPresent: false,
      tagAddAttempted: false,
      tagAddSucceeded: false,
      briitelyHttpStatus: null,
      errorStage: "no_contact_id",
    });
    return NextResponse.json({ error: "No Briitely contact linked to this Travel File." }, { status: 400 });
  }

  const result = await addContactTag(contactId, TEST_TAG);

  console.info("PORTAL_BRIITELY_TEST_TRIGGER", {
    travelFileId,
    contactIdPresent: true,
    tagAddAttempted: true,
    tagAddSucceeded: result.succeeded,
    briitelyHttpStatus: result.httpStatus,
    errorStage: result.errorStage,
  });

  if (result.succeeded) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "trigger_failed" }, { status: 502 });
}
