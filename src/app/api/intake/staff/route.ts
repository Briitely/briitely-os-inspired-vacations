import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { processIntake, validateIntake, type IntakeDeployment, type IntakeInput } from "@/lib/travel/intake";
import { createClient } from "@/lib/supabase/server";
import { validateWorkflowJump } from "@/lib/travel/workflow-jump";

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const rawDeployment = body.deployment as Partial<IntakeDeployment> | null | undefined;
  const deployment: IntakeDeployment | null = rawDeployment && typeof rawDeployment.actionCode === "string"
    ? { actionCode: rawDeployment.actionCode, responsibleUserId: rawDeployment.responsibleUserId ? String(rawDeployment.responsibleUserId) : null, dueAt: rawDeployment.dueAt ? String(rawDeployment.dueAt) : null, retainerAgreementConfirmed: rawDeployment.retainerAgreementConfirmed === true }
    : null;
  if (deployment) {
    if (body.isFit !== "yes") return NextResponse.json({ error: "Only clients marked as a fit can be entered at a workflow stage." }, { status: 400 });
    if (deployment.actionCode === "book_initial_consultation") return NextResponse.json({ error: "Use Create Inquiry to start at Book Initial Consultation." }, { status: 400 });
    const check = await validateWorkflowJump(await createClient(), { ...deployment, userId: auth.user.id });
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const input: IntakeInput = {
    firstName:String(body.firstName??""),lastName:String(body.lastName??""),email:String(body.email??""),phone:String(body.phone??""),
    destination:String(body.destination??""),tripType:String(body.tripType??""),travelTimeframe:String(body.travelTimeframe??""),budgetRange:String(body.budgetRange??""),
    numberOfAdults:Number(body.numberOfAdults)||0,numberOfChildren:body.numberOfChildren?Number(body.numberOfChildren):null,childrenAges:body.childrenAges?String(body.childrenAges):null,
    travelInterests:Array.isArray(body.travelInterests)?body.travelInterests.map(String):[],travelSeasons:Array.isArray(body.travelSeasons)?body.travelSeasons.map(String):[],lastTravelDestination:null,lastTravelDate:null,
    referralSource:String(body.referralSource??""),referralDetail:body.referralDetail?String(body.referralDetail):null,eventDetail:body.eventDetail?String(body.eventDetail):null,specialConsiderations:body.specialConsiderations?String(body.specialConsiderations):null,
    consent:Boolean(body.consent??true),intakeSource:"staff",intakeMethod:String(body.intakeMethod??"staff"),staffNotes:body.staffNotes?String(body.staffNotes):null,staffUserId:auth.user.id,
    newClient:body.newClient===true,isFit:body.isFit==="yes"||body.isFit==="no"?body.isFit:"",markDnb:Boolean(body.markDnb),lostReason:body.lostReason?String(body.lostReason):null,deployment,
  };
  const validation=validateIntake(input);if(!validation.valid)return NextResponse.json({error:validation.errors.join(" ")},{status:400});
  const result=await processIntake(input);if(!result.success)return NextResponse.json({error:result.error??"Submission failed."},{status:500});
  return NextResponse.json({success:true,travelFileId:result.travelFileId,briitelySyncPending:result.briitelySyncPending,deploymentError:result.deploymentError??null});
}
