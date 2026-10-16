import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { parseDateOnly } from "@/lib/travel/format";

export async function DELETE(_request:Request,{params}:{params:Promise<{travelFileId:string}>}){
  const{user}=await getAuthenticatedUser();if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
  if(!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});
  const{travelFileId}=await params,supabase=await createClient();
  const{data:file,error:fetchError}=await supabase.from("travel_files").select("id, client_name, destination, trip_type").eq("id",travelFileId).maybeSingle();
  if(fetchError||!file)return NextResponse.json({error:"Travel File not found."},{status:404});
  const{error:deleteError}=await supabase.from("travel_files").delete().eq("id",travelFileId);
  if(deleteError)return NextResponse.json({error:"Failed to delete Travel File."},{status:500});
  return NextResponse.json({success:true});
}

interface EditRequestBody{
  destination?:string;tripType?:string;travelTimeframe?:string;departureDate?:string|null;returnDate?:string|null;numberOfAdults?:number;numberOfChildren?:number|null;childrenAges?:string|null;budgetRange?:string;insuranceInterest?:string|null;specialConsiderations?:string|null;travelInterests?:string[];travelSeasons?:string[];inquirySource?:string;intakeMethod?:string;referralDetail?:string|null;eventDetail?:string|null;staffNotes?:string|null;internalNotes?:string|null;assignedAdvisorId?:string|null;updatedAt?:string;
  proposalDueDate?:string|null;dateBooked?:string|null;totalBookingValue?:number|null;tmfAmount?:number|null;clientbaseResCardId?:string|null;primaryBookingNumber?:string|null;travefyProposalUrl?:string|null;travefyTripPlanUrl?:string|null;
  insuranceStatus?:string;insuranceWaiverSigned?:boolean|null;pretripMeetingRequired?:boolean|null;pretripMeetingBookedAt?:string|null;pretripCardSentAt?:string|null;bookingRegistrationEligible?:boolean;bookingRegistrationDoneAt?:string|null;
}
function isValidUrl(value:string){if(!value)return true;try{const u=new URL(value);return u.protocol==="http:"||u.protocol==="https:"}catch{return false}}

export async function PATCH(request:Request,{params}:{params:Promise<{travelFileId:string}>}){
  const{user}=await getAuthenticatedUser();if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
  if(!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});
  const{travelFileId}=await params,body=(await request.json())as Partial<EditRequestBody>,supabase=await createClient();
  const{data:existing,error:fetchError}=await supabase.from("travel_files").select("updated_at,file_status,stage,insurance_interest,assigned_advisor_id,client_rollup_recorded_at,departure_date,return_date,current_action_id,current_action:travel_actions!current_action_id(id,action_code,status)").eq("id",travelFileId).maybeSingle();
  if(fetchError||!existing)return NextResponse.json({error:"Travel File not found."},{status:404});
  if(body.updatedAt&&body.updatedAt!==existing.updated_at)return NextResponse.json({error:"This Travel File was modified by another user. Please reload and try again."},{status:409});
  if((body.departureDate===undefined?existing.departure_date:body.departureDate)&&(body.returnDate===undefined?existing.return_date:body.returnDate)&&parseDateOnly((body.returnDate===undefined?existing.return_date:body.returnDate)!)<parseDateOnly((body.departureDate===undefined?existing.departure_date:body.departureDate)!))return NextResponse.json({error:"Return date cannot be before departure date."},{status:400});
  if(body.travefyProposalUrl!==undefined&&body.travefyProposalUrl&&!isValidUrl(body.travefyProposalUrl))return NextResponse.json({error:"Travefy Proposal URL must be a valid http:// or https:// URL."},{status:400});
  if(body.travefyTripPlanUrl!==undefined&&body.travefyTripPlanUrl&&!isValidUrl(body.travefyTripPlanUrl))return NextResponse.json({error:"Travefy Trip Plan URL must be a valid http:// or https:// URL."},{status:400});
  if(body.totalBookingValue!==undefined&&body.totalBookingValue!==null&&(isNaN(body.totalBookingValue)||body.totalBookingValue<0))return NextResponse.json({error:"Total Booking Value must be a valid number."},{status:400});
  if(body.tmfAmount!==undefined&&body.tmfAmount!==null&&(isNaN(body.tmfAmount)||body.tmfAmount<0))return NextResponse.json({error:"Retainer Amount must be a valid number."},{status:400});

  const updates:Record<string,unknown>={};
  if(body.destination!==undefined)updates.destination=body.destination?.trim()||null;
  if(body.tripType!==undefined)updates.trip_type=body.tripType||null;
  if(body.travelTimeframe!==undefined)updates.travel_timeframe=body.travelTimeframe?.trim()||null;
  if(body.departureDate!==undefined)updates.departure_date=body.departureDate||null;
  if(body.returnDate!==undefined)updates.return_date=body.returnDate||null;
  if(body.budgetRange!==undefined)updates.budget_range=body.budgetRange||null;
  if(body.insuranceInterest!==undefined)updates.insurance_interest=body.insuranceInterest||null;
  if(body.specialConsiderations!==undefined)updates.special_requests=body.specialConsiderations?.trim()||null;
  if(body.travelInterests!==undefined)updates.travel_interests=body.travelInterests.length?body.travelInterests:null;
  if(body.travelSeasons!==undefined)updates.travel_seasons=body.travelSeasons.length?body.travelSeasons:null;
  if(body.inquirySource!==undefined)updates.inquiry_source=body.inquirySource||null;
  if(body.intakeMethod!==undefined)updates.intake_method=body.intakeMethod||null;
  if(body.referralDetail!==undefined)updates.referral_detail=body.referralDetail?.trim()||null;
  if(body.eventDetail!==undefined)updates.event_detail=body.eventDetail?.trim()||null;
  if(body.staffNotes!==undefined)updates.staff_notes=body.staffNotes?.trim()||null;
  if(body.internalNotes!==undefined)updates.internal_notes=body.internalNotes?.trim()||null;
  if(body.assignedAdvisorId!==undefined)updates.assigned_advisor_id=body.assignedAdvisorId||null;
  if(body.childrenAges!==undefined)updates.children_ages=body.childrenAges?.trim()||null;
  if(body.proposalDueDate!==undefined)updates.proposal_due_date=body.proposalDueDate||null;
  if(body.dateBooked!==undefined)updates.date_booked=body.dateBooked||null;
  if(body.totalBookingValue!==undefined)updates.total_booking_value=body.totalBookingValue;
  if(body.tmfAmount!==undefined)updates.tmf_amount=body.tmfAmount;
  if(body.clientbaseResCardId!==undefined)updates.clientbase_res_card_id=body.clientbaseResCardId?.trim()||null;
  if(body.primaryBookingNumber!==undefined)updates.primary_booking_number=body.primaryBookingNumber?.trim()||null;
  if(body.travefyProposalUrl!==undefined)updates.travefy_proposal_url=body.travefyProposalUrl||null;
  if(body.travefyTripPlanUrl!==undefined)updates.travefy_trip_plan_url=body.travefyTripPlanUrl||null;
  if(body.insuranceStatus!==undefined)updates.insurance_status=body.insuranceStatus;
  if(body.insuranceWaiverSigned!==undefined)updates.insurance_waiver_signed=body.insuranceWaiverSigned;
  if(body.pretripMeetingRequired!==undefined)updates.pretrip_meeting_required=body.pretripMeetingRequired;
  if(body.pretripMeetingBookedAt!==undefined)updates.pretrip_meeting_booked_at=body.pretripMeetingBookedAt||null;
  if(body.pretripCardSentAt!==undefined)updates.pretrip_card_sent_at=body.pretripCardSentAt||null;
  if(body.bookingRegistrationEligible!==undefined)updates.booking_registration_eligible=body.bookingRegistrationEligible;
  if(body.bookingRegistrationDoneAt!==undefined)updates.booking_registration_done_at=body.bookingRegistrationDoneAt||null;
  if(body.numberOfAdults!==undefined||body.numberOfChildren!==undefined){let adults=body.numberOfAdults,children=body.numberOfChildren;if(adults===undefined||children===undefined){const{data:current}=await supabase.from("travel_files").select("number_of_adults, number_of_children").eq("id",travelFileId).maybeSingle();if(adults===undefined)adults=current?.number_of_adults??1;if(children===undefined)children=current?.number_of_children??0}const childCount=children??0;updates.number_of_adults=adults;updates.number_of_children=childCount;updates.number_of_travellers=(adults??0)+childCount}
  // Insurance added after consultation must not be lost between workflow stages.
  // Do not create another task for edits to an existing insurance request.
  const requestedInsurance=(value:string|null|undefined)=>Boolean(value?.trim()&&!value.toLowerCase().includes("decline all travel insurance"));
  const newInsurance=body.insuranceInterest!==undefined&&requestedInsurance(body.insuranceInterest)&&!requestedInsurance(existing.insurance_interest);
  let insuranceAssigneeId:string|null=null;
  if(newInsurance){
    // Resolve the actual staff profile rather than relying on a name-prefix filter.
    // Prefer the Travel File advisor when that advisor is Tracy.
    const {data:advisors,error:advisorError}=await supabase.from("profiles").select("id,full_name,is_active").eq("is_active",true).in("role",["staff","admin","super_admin"]);
    if(advisorError)return NextResponse.json({error:"Could not load active team members for insurance assignment."},{status:500});
    const tracy=advisors?.find(advisor=>advisor.id===existing.assigned_advisor_id&&/\btracy\b/i.test(advisor.full_name??""))
      ??advisors?.find(advisor=>/\btracy\b/i.test(advisor.full_name??""));
    if(!tracy)return NextResponse.json({error:"Could not identify Tracy in the active team member list. Please check her staff profile."},{status:409});
    insuranceAssigneeId=tracy.id;
  }
  const changedFieldCount=Object.keys(updates).length;if(!changedFieldCount)return NextResponse.json({success:true,changedFieldCount:0});
  const{error:updateError}=await supabase.from("travel_files").update(updates).eq("id",travelFileId);if(updateError)return NextResponse.json({error:"Failed to update Travel File."},{status:500});
  if(newInsurance&&insuranceAssigneeId){
    const {data:pendingTasks,error:lookupError}=await supabase.from("travel_file_tasks").select("id").eq("travel_file_id",travelFileId).eq("title","Review insurance quotes requested").is("completed_at",null).limit(1);
    if(lookupError)return NextResponse.json({error:"Insurance preference saved, but could not check existing insurance tasks."},{status:500});
    if(!pendingTasks?.length){
      const dueDate=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Edmonton",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
      const {error:taskError}=await supabase.from("travel_file_tasks").insert({travel_file_id:travelFileId,title:"Review insurance quotes requested",notes:`Client asked for: ${body.insuranceInterest}`,assigned_to:insuranceAssigneeId,due_date:dueDate,created_by:user.id});
      if(taskError)return NextResponse.json({error:"Insurance preference saved, but the follow-up task could not be created."},{status:500});
    }
  }
  const currentAction=Array.isArray(existing.current_action)?existing.current_action[0]:existing.current_action;
  // Reconcile the workflow only when the trip dates actually change.
  const datesChanged=(body.departureDate!==undefined&&body.departureDate!==existing.departure_date)||
    (body.returnDate!==undefined&&body.returnDate!==existing.return_date);
  const departure=body.departureDate===undefined?existing.departure_date:body.departureDate;
  const returning=body.returnDate===undefined?existing.return_date:body.returnDate;
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Edmonton",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const activeCode=currentAction?.status==="active"?currentAction.action_code:null;
  const lifecycleActions=["waiting_for_travel","travelling","post_trip_close_file"];
  const eligible=datesChanged&&existing.file_status==="open"&&activeCode&&lifecycleActions.includes(activeCode);
  const desiredCode=eligible?(
    returning&&returning<today?"post_trip_close_file":
    departure&&departure<=today?"travelling":
    departure&&departure>today?"waiting_for_travel":null
  ):null;
  if(desiredCode&&existing.current_action_id&&activeCode){
    if(desiredCode===activeCode){
      const dueDate=desiredCode==="waiting_for_travel"?departure:desiredCode==="travelling"?returning:null;
      const {error:dueError}=await supabase.from("travel_actions").update({due_at:dueDate?`${dueDate}T12:00:00Z`:null}).eq("id",existing.current_action_id).eq("travel_file_id",travelFileId);
      if(dueError)return NextResponse.json({error:"Dates saved, but Current Action due date synchronization failed."},{status:500});
    }else{
      const now=new Date().toISOString();
      const postTrip=desiredCode==="post_trip_close_file",waiting=desiredCode==="waiting_for_travel";
      const newStage=postTrip?"post_trip":waiting?"trip_plans_created":"travelling";
      const dueDate=waiting?departure:postTrip?null:returning;
      const {data:next,error:nextError}=await supabase.from("travel_actions").insert({
        travel_file_id:travelFileId,action_code:desiredCode,
        title:postTrip?"Post-Trip / Close File":waiting?"Waiting for Travel":"Travelling",
        description:postTrip?"Complete post-trip follow-up and close the Travel File.":waiting?"Trip setup is complete. Waiting for the departure date.":"Client is travelling. Automatically advances after the return date.",
        action_role:postTrip?"blocking":"supporting",responsible_type:postTrip?"internal":"system",
        responsible_user_id:postTrip?existing.assigned_advisor_id:null,
        due_at:dueDate?`${dueDate}T12:00:00Z`:null,
        status:"active",waiting_since:now,activated_at:now,
        metadata:{trigger:"travel_dates_reconciled",departure_date:departure,return_date:returning}
      }).select("id").single();
      if(nextError||!next)return NextResponse.json({error:"Dates saved, but workflow reconciliation failed."},{status:500});
      const {data:advanced,error:advanceError}=await supabase.from("travel_files").update({
        stage:newStage,stage_changed_at:now,current_action_id:next.id
      }).eq("id",travelFileId).eq("current_action_id",existing.current_action_id).eq("file_status","open").select("id").maybeSingle();
      if(advanceError||!advanced){
        await supabase.from("travel_actions").delete().eq("id",next.id);
        return NextResponse.json({error:"Dates saved, but workflow changed concurrently. Reload the file."},{status:409});
      }
      const {error:completeError}=await supabase.from("travel_actions").update({
        status:"completed",completed_at:now,completion_source:"system",completion_event:"travel_dates_reconciled"
      }).eq("id",existing.current_action_id).eq("status","active");
      if(completeError)return NextResponse.json({error:"Workflow advanced, but previous action could not be completed."},{status:500});
      const backwards=(activeCode==="post_trip_close_file"&&!postTrip)||(activeCode==="travelling"&&waiting);
      await supabase.from("travel_activity").insert({
        travel_file_id:travelFileId,event_type:"travel_dates_reconciled",
        summary:`Travel dates changed. Workflow moved to ${postTrip?"Post-Trip / Close File":waiting?"Waiting for Travel":"Travelling"}.${backwards&&existing.client_rollup_recorded_at?" Trip history previously recorded; review required.":""}`,
        actor_type:"system",actor_user_id:null,action_id:next.id,previous_stage:existing.stage,new_stage:newStage,
        metadata:{departure_date:departure,return_date:returning,previous_action:activeCode,trip_history_review_required:Boolean(backwards&&existing.client_rollup_recorded_at)}
      });
    }
  }
  await supabase.from("travel_activity").insert({travel_file_id:travelFileId,event_type:"travel_file_updated",summary:"Travel File details updated.",actor_type:"internal",actor_user_id:user.id,metadata:{changedFields:Object.keys(updates)}});
  return NextResponse.json({success:true,changedFieldCount});
}
