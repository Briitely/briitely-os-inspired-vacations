import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { findContactCustomField, updateContactCustomField } from "@/lib/briitely/contact-custom-fields";

const TRAVEL_INTERESTS_FIELD_NAME = "Travel Interests";

export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const fieldDef = await findContactCustomField(TRAVEL_INTERESTS_FIELD_NAME);

  if (!fieldDef) {
    console.info("PORTAL_BRIITELY_TRAVEL_INTERESTS_TEST", {
      stage: "field_definition_lookup",
      contactIdPresent: false,
      customFieldId: null,
      fieldType: null,
      selectedOptionCount: 0,
      writeAttempted: false,
      briitelyHttpStatus: null,
      writeSucceeded: false,
      errorStage: "field_not_found",
    });
    return NextResponse.json(
      { error: "Travel Interests custom field not found in Briitely." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    fieldId: fieldDef.id,
    fieldKey: fieldDef.fieldKey,
    dataType: fieldDef.dataType,
    options: fieldDef.picklistOptions,
  });
}

export async function POST(
  req: Request,
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
    console.info("PORTAL_BRIITELY_TRAVEL_INTERESTS_TEST", {
      contactIdPresent: false,
      customFieldId: null,
      fieldType: null,
      selectedOptionCount: 0,
      writeAttempted: false,
      briitelyHttpStatus: null,
      writeSucceeded: false,
      errorStage: "travel_file_not_found",
    });
    return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  }

  const contactId = file.briitely_contact_id;
  if (!contactId) {
    console.info("PORTAL_BRIITELY_TRAVEL_INTERESTS_TEST", {
      contactIdPresent: false,
      customFieldId: null,
      fieldType: null,
      selectedOptionCount: 0,
      writeAttempted: false,
      briitelyHttpStatus: null,
      writeSucceeded: false,
      errorStage: "no_contact_id",
    });
    return NextResponse.json(
      { error: "No Briitely contact linked to this Travel File." },
      { status: 400 }
    );
  }

  let body: { selectedOptions?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const selectedOptions = body.selectedOptions ?? [];
  if (selectedOptions.length === 0) {
    return NextResponse.json(
      { error: "Select at least one Travel Interest to sync." },
      { status: 400 }
    );
  }

  const fieldDef = await findContactCustomField(TRAVEL_INTERESTS_FIELD_NAME);
  if (!fieldDef) {
    console.info("PORTAL_BRIITELY_TRAVEL_INTERESTS_TEST", {
      contactIdPresent: true,
      customFieldId: null,
      fieldType: null,
      selectedOptionCount: selectedOptions.length,
      selectedOptions,
      writeAttempted: false,
      briitelyHttpStatus: null,
      writeSucceeded: false,
      errorStage: "field_not_found",
    });
    return NextResponse.json(
      { error: "Travel Interests custom field not found in Briitely." },
      { status: 404 }
    );
  }

  const fieldValue = selectedOptions.join(", ");

  const result = await updateContactCustomField(
    contactId,
    fieldDef.id,
    fieldDef.fieldKey,
    fieldValue
  );

  console.info("PORTAL_BRIITELY_TRAVEL_INTERESTS_TEST", {
    contactIdPresent: true,
    customFieldId: fieldDef.id,
    fieldType: fieldDef.dataType,
    selectedOptionCount: selectedOptions.length,
    selectedOptions,
    writeAttempted: true,
    briitelyHttpStatus: result.httpStatus,
    writeSucceeded: result.succeeded,
    errorStage: result.errorStage,
  });

  if (result.succeeded) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "sync_failed" }, { status: 502 });
}
