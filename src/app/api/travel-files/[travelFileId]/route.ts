import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { parseDateOnly } from "@/lib/travel/format";

export async function DELETE(_request:Request,{params}:{params:Promise<{travelFileId:string}>}){
  const{user}=await getAuthenticatedUser();if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
  if(user.role!=="admin"&&user.role!=="super_admin")return NextResponse.json({error:"Admin access required."},{status:403});
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
  const{data:existing,error:fetchError}=await supabase.from("travel_files").select("updated_at").eq("id",travelFileId).maybeSingle();
  if(fetchError||!existing)return NextResponse.json({error:"Travel File not found."},{status:404});
  if(body.updatedAt&&body.updatedAt!==existing.updated_at)return NextResponse.json({error:"This Travel File was modified by another user. Please reload and try again."},{status:409});
  if(body.departureDate&&body.returnDate&&parseDateOnly(body.returnDate)<parseDateOnly(body.departureDate))return NextResponse.json({error:"Return date cannot be before departure date."},{status:400});
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
  const changedFieldCount=Object.keys(updates).length;if(!changedFieldCount)return NextResponse.json({success:true,changedFieldCount:0});
  const{error:updateError}=await supabase.from("travel_files").update(updates).eq("id",travelFileId);if(updateError)return NextResponse.json({error:"Failed to update Travel File."},{status:500});
  await supabase.from("travel_activity").insert({travel_file_id:travelFileId,event_type:"travel_file_updated",summary:"Travel File details updated.",actor_type:"internal",actor_user_id:user.id,metadata:{changedFields:Object.keys(updates)}});
  return NextResponse.json({success:true,changedFieldCount});
}
