import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getTmfTemplateId,
  isTmfTemplateConfigured,
  populateTmfContactFields,
  sendDocumentTemplate,
  type TmfTemplateType,
} from "@/lib/briitely/documents";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ travelFileId: string }> }
) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (user.role !== "staff" && user.role !== "admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  }

  const { travelFileId } = await params;
  const supabase = await createClient();

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isValidUuid = uuidRegex.test(travelFileId);

  const { data: rawFile, error: fileError } = await supabase
    .from("travel_files")
    .select(`
      id,
      stage,
      briitely_contact_id,
      client_name,
      destination,
      tmf_agreement_type,
      tmf_amount,
      revisions_included,
      lead_opportunity_id,
      current_action:travel_actions!current_action_id (
        id,
        action_code,
        status,
        responsible_type,
        responsible_user_id
      ),
      assigned_advisor:profiles!assigned_advisor_id (id, full_name, ghl_user_id)
    `)
    .eq("id", travelFileId)
    .maybeSingle();

  console.info("TMF_DOCUMENT_SEND_LOOKUP", {
    routeTravelFileId: travelFileId,
    validUuid: isValidUuid,
    travelFileFound: !!rawFile,
    fileError: fileError?.message ?? null,
    briitelyContactIdPresent: !!(rawFile as Record<string, unknown> | null)?.briitely_contact_id,
  });

  if (fileError || !rawFile) {
    return NextResponse.json({ error: "Travel File not found." }, { status: 404 });
  }

  const file = rawFile as {
    id: string;
    stage: string;
    briitely_contact_id: string;
    client_name: string;
    destination: string | null;
    tmf_agreement_type: string | null;
    tmf_amount: number | null;
    revisions_included: number | null;
    lead_opportunity_id: string | null;
    current_action: {
      id: string;
      action_code: string;
      status: string;
      responsible_type: string;
      responsible_user_id: string | null;
    } | null;
    assigned_advisor: {
      id: string;
      full_name: string;
      ghl_user_id: string | null;
    } | null;
  };

  const { data: existingDoc } = await supabase
    .from("travel_files")
    .select("tmf_document_id, tmf_sent_at")
    .eq("id", travelFileId)
    .maybeSingle();

  const existingDocRow = existingDoc as { tmf_document_id: string | null; tmf_sent_at: string | null } | null;
  if (existingDocRow?.tmf_document_id && existingDocRow?.tmf_sent_at) {
    console.info("TMF_DOCUMENT_SEND", {
      travelFileId,
      result: "already_sent",
      documentId: existingDocRow.tmf_document_id,
    });
    return NextResponse.json({
      success: true,
      result: "already_sent",
      message: "TMF Agreement has already been sent.",
      documentId: existingDocRow.tmf_document_id,
    });
  }

  const currentAction = file.current_action;
  if (!currentAction || currentAction.action_code !== "send_tmf_agreement") {
    return NextResponse.json(
      { error: "No pending Send TMF Agreement action on this Travel File." },
      { status: 400 }
    );
  }

  if (currentAction.status === "completed") {
    return NextResponse.json({
      success: true,
      result: "already_processed",
      message: "TMF Agreement action has already been completed.",
    });
  }

  const isAdmin = user.role === "admin" || user.role === "super_admin";
  const isResponsible =
    currentAction.responsible_type === "internal" &&
    currentAction.responsible_user_id === user.id;
  if (!isAdmin && !isResponsible) {
    return NextResponse.json(
      { error: "Only the responsible user or an admin can send the TMF Agreement." },
      { status: 403 }
    );
  }

  if (!file.tmf_agreement_type || (file.tmf_agreement_type !== "ivt" && file.tmf_agreement_type !== "all_inclusive")) {
    return NextResponse.json(
      { error: "Agreement type is not set on this Travel File. Please complete the consultation first." },
      { status: 400 }
    );
  }

  const agreementType = file.tmf_agreement_type as TmfTemplateType;
  const templateConfigured = isTmfTemplateConfigured(agreementType);
  const templateId = getTmfTemplateId(agreementType);
  if (!templateConfigured || !templateId) {
    const envVar =
      agreementType === "all_inclusive"
        ? "TMF_TEMPLATE_ID_ALL_INCLUSIVE"
        : "TMF_TEMPLATE_ID_IVT";
    console.error("TMF_DOCUMENT_SEND", {
      travelFileId,
      errorStage: "template_not_configured",
      agreementType,
      envVar,
    });
    return NextResponse.json(
      { error: `The ${agreementType === "all_inclusive" ? "All-Inclusive" : "IVT"} TMF template is not configured. Please set the ${envVar} environment variable.` },
      { status: 500 }
    );
  }

  if (!file.briitely_contact_id) {
    console.error("TMF_DOCUMENT_SEND", { travelFileId, errorStage: "no_contact_id" });
    return NextResponse.json(
      { error: "No Briitely contact is linked to this Travel File." },
      { status: 400 }
    );
  }

  // Documents should be sent as the assigned advisor, even though Dana owns
  // the operational Send TMF Agreement action in the portal.
  const senderGhlUserId = file.assigned_advisor?.ghl_user_id ?? null;
  if (!senderGhlUserId) {
    console.error("TMF_DOCUMENT_SEND", {
      travelFileId,
      errorStage: "no_advisor_ghl_user_id",
      advisorId: file.assigned_advisor?.id ?? null,
    });
    return NextResponse.json(
      { error: "The assigned advisor is not linked to a Briitely user. Please set the advisor's Briitely user ID before sending the TMF Agreement." },
      { status: 400 }
    );
  }

  const missingFields: string[] = [];
  if (!file.destination) missingFields.push("Destination");
  if (!file.assigned_advisor?.full_name) missingFields.push("Assigned Advisor");
  if (file.tmf_amount == null) missingFields.push("TMF Amount");
  if (agreementType === "ivt" && file.revisions_included == null) {
    missingFields.push("Revisions Included");
  }
  if (missingFields.length > 0) {
    console.error("TMF_DOCUMENT_SEND", {
      travelFileId,
      errorStage: "missing_required_values",
      missingFields,
    });
    return NextResponse.json(
      { error: `Cannot send TMF Agreement: the following required values are missing: ${missingFields.join(", ")}. Please update the Travel File first.` },
      { status: 400 }
    );
  }

  const advisorFullName = file.assigned_advisor!.full_name.trim();
  const advisorFirstName = advisorFullName.split(/\s+/)[0];
  if (!advisorFirstName) {
    return NextResponse.json(
      { error: "The assigned advisor's first name could not be determined. Please update the advisor profile before sending the TMF Agreement." },
      { status: 400 }
    );
  }

  const agreementDate = new Date().toLocaleDateString("en-CA");
  const populateResult = await populateTmfContactFields(
    file.briitely_contact_id,
    {
      destination: file.destination!,
      assignedAdvisorName: advisorFullName,
      assignedAdvisorFirstName: advisorFirstName,
      tmfAmount: file.tmf_amount!,
      agreementDate,
      revisionsIncluded: agreementType === "ivt" ? file.revisions_included : null,
    }
  );

  if (!populateResult.succeeded) {
    console.error("TMF_DOCUMENT_SEND", {
      travelFileId,
      errorStage: "custom_field_population_failed",
      failedFields: populateResult.failedFields,
    });
    return NextResponse.json(
      { error: `Could not populate all document fields on the contact record. Missing custom fields: ${populateResult.failedFields.join(", ")}. Please ensure these custom fields exist in Briitely.` },
      { status: 500 }
    );
  }

  console.info("TMF_DOCUMENT_SEND", {
    travelFileId,
    agreementType,
    templateConfigured: true,
    contactIdPresent: !!file.briitely_contact_id,
    senderResolved: !!senderGhlUserId,
    senderSource: "assigned_advisor",
    customFieldsPopulated: populateResult.updatedFields,
    sendAttempted: true,
  });

  const sendResult = await sendDocumentTemplate({
    templateId,
    userId: senderGhlUserId,
    contactId: file.briitely_contact_id,
    sendDocument: true,
  });

  if (!sendResult.success || !sendResult.documentId) {
    console.error("TMF_DOCUMENT_SEND", {
      travelFileId,
      errorStage: "api_send_failed",
      apiError: sendResult.error ?? "unknown",
      documentIdPresent: !!sendResult.documentId,
      finalResult: "failed",
    });
    return NextResponse.json(
      { error: sendResult.error ?? "Failed to send the TMF Agreement. Please try again." },
      { status: 502 }
    );
  }

  const documentId = sendResult.documentId;
  const now = new Date().toISOString();

  console.info("TMF_DOCUMENT_SEND", {
    travelFileId,
    agreementType,
    templateConfigured: true,
    contactIdPresent: true,
    senderResolved: true,
    senderSource: "assigned_advisor",
    sendAttempted: true,
    apiStatus: "success",
    documentIdPresent: true,
    finalResult: "sent",
  });

  const { error: actionCompleteError } = await supabase
    .from("travel_actions")
    .update({
      status: "completed",
      completed_at: now,
      completed_by: user.id,
      completion_source: "portal",
    })
    .eq("id", currentAction.id);

  if (actionCompleteError) {
    console.error("TMF_DOCUMENT_SEND", {
      travelFileId,
      errorStage: "action_complete_failed",
      errorMessage: actionCompleteError.message,
      documentId,
    });
    await supabase
      .from("travel_files")
      .update({ tmf_document_id: documentId, tmf_sent_at: now })
      .eq("id", travelFileId);
    return NextResponse.json(
      { error: "The agreement was sent but the action could not be marked complete. Please contact an administrator." },
      { status: 500 }
    );
  }

  const { data: newAction, error: actionCreateError } = await supabase
    .from("travel_actions")
    .insert({
      travel_file_id: travelFileId,
      action_code: "await_tmf_signature",
      title: "Await TMF Agreement Signature",
      action_role: "blocking",
      responsible_type: "client",
      status: "active",
      waiting_since: now,
      activated_at: now,
    })
    .select("id")
    .single();

  if (actionCreateError || !newAction) {
    console.error("TMF_DOCUMENT_SEND", {
      travelFileId,
      errorStage: "create_await_action_failed",
      errorMessage: actionCreateError?.message,
    });
    await supabase
      .from("travel_files")
      .update({
        stage: "tmf_sent",
        stage_changed_at: now,
        tmf_document_id: documentId,
        tmf_sent_at: now,
        current_action_id: null,
      })
      .eq("id", travelFileId);
    return NextResponse.json(
      { error: "The agreement was sent but the next action could not be created. Please contact an administrator." },
      { status: 500 }
    );
  }

  const { error: fileUpdateError } = await supabase
    .from("travel_files")
    .update({
      stage: "tmf_sent",
      stage_changed_at: now,
      current_action_id: newAction.id,
    })
    .eq("id", travelFileId);

  if (fileUpdateError) {
    console.error("TMF_DOCUMENT_SEND", {
      travelFileId,
      errorStage: "file_update_failed",
      errorMessage: fileUpdateError.message,
    });
    await supabase.from("travel_actions").delete().eq("id", newAction.id);
    await supabase.from("travel_actions").update({
      status: "active",
      completed_at: null,
      completed_by: null,
      completion_source: null,
    }).eq("id", currentAction.id);
    return NextResponse.json(
      { error: "The agreement was sent but the Travel File could not be updated. Please contact an administrator." },
      { status: 500 }
    );
  }

  await supabase
    .from("travel_files")
    .update({ tmf_document_id: documentId, tmf_sent_at: now })
    .eq("id", travelFileId);

  await supabase.from("travel_activity").insert({
    travel_file_id: travelFileId,
    event_type: "tmf_agreement_sent",
    summary: "TMF Agreement sent to client.",
    actor_type: "internal",
    actor_user_id: user.id,
    action_id: currentAction.id,
    previous_stage: file.stage,
    new_stage: "tmf_sent",
    metadata: { documentId, agreementType, sendingAdvisor: advisorFullName },
  });

  console.info("TMF_DOCUMENT_SEND", {
    travelFileId,
    finalResult: "transitioned",
    newStage: "tmf_sent",
    newActionId: newAction.id,
  });

  return NextResponse.json({
    success: true,
    result: "sent",
    stage: "tmf_sent",
    documentId,
    nextAction: { id: newAction.id, title: "Await TMF Agreement Signature" },
  });
}
