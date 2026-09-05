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

export interface IntakeInput {
  firstName: string; lastName: string; email: string; phone: string;
  destination: string; tripType: string; travelTimeframe: string; budgetRange: string;
  numberOfAdults: number; numberOfChildren: number | null; childrenAges: string | null;
  travelInterests: string[]; travelSeasons: string[];
  lastTravelDestination: string | null; lastTravelDate: string | null;
  referralSource: string; referralDetail: string | null; eventDetail: string | null;
  specialConsiderations: string | null; consent: boolean;
  intakeSource: "website" | "staff"; intakeMethod: string; staffNotes: string | null; staffUserId: string | null;
}
export interface IntakeResult {success:boolean;travelFileId:string|null;briitelyContactId:string|null;error:string|null;briitelySyncPending:boolean}
interface DefaultInquiryOwner {portalProfileId:string;briitelyUserId:string}
async function getDefaultInquiryOwner():Promise<DefaultInquiryOwner>{const portalProfileId=process.env.DEFAULT_INQUIRY_OWNER_PROFILE_ID??"";let briitelyUserId="";if(portalProfileId){const supabase=await createClient();const{data:profile}=await supabase.from("profiles").select("ghl_user_id").eq("id",portalProfileId).maybeSingle();if(profile?.ghl_user_id)briitelyUserId=profile.ghl_user_id;else console.warn("INTAKE_CONFIG",{warning:"DEFAULT_INQUIRY_OWNER_PROFILE_ID is set but the profile has no ghl_user_id — Briitely contact assignment will be skipped",profileId:portalProfileId})}return{portalProfileId,briitelyUserId}}
export interface ValidationResult {valid:boolean;errors:string[]}
export function validateIntake(input:IntakeInput):ValidationResult{const errors:string[]=[];if(!input.firstName.trim())errors.push("First name is required.");if(!input.lastName.trim())errors.push("Last name is required.");if(!input.email.trim())errors.push("Email is required.");if(!input.phone.trim())errors.push("Phone is required.");if(!input.destination.trim())errors.push("Destination is required.");if(!input.tripType.trim())errors.push("Trip type is required.");if(!input.travelTimeframe.trim())errors.push("Travel timeframe is required.");if(!input.budgetRange.trim())errors.push("Budget range is required.");if(input.intakeSource==="website"&&!input.referralSource.trim())errors.push("How did you hear about us is required.");if(!input.consent)errors.push("Consent is required.");const adults=input.numberOfAdults;if(typeof adults!=="number"||!Number.isFinite(adults)||adults<1)errors.push("At least one adult is required.");if(input.numberOfChildren!==null&&input.numberOfChildren<0)errors.push("Number of children cannot be negative.");if(input.numberOfChildren!==null&&input.numberOfChildren>0&&(!input.childrenAges||!input.childrenAges.trim()))errors.push("Ages of children is required when number of children is greater than zero.");return{valid:errors.length===0,errors}}
export function calculateTravellerCount(adults:number,children:number|null):number{return adults+(children??0)}
export function resolveIntakeTags(input:IntakeInput):string[]{const interestTags=resolveTagsFromSelections(travelInterestOptions,input.travelInterests);const seasonTags=resolveTagsFromSelections(travelSeasonOptions,input.travelSeasons);const sourceTags=input.referralSource?resolveTagsFromSelections(referralSourceOptions,[input.referralSource]):[];return[...interestTags,...seasonTags,...sourceTags]}

export async function processIntake(input:IntakeInput):Promise<IntakeResult>{
  const supabase=await createClient();const owner=await getDefaultInquiryOwner();const numberOfChildren=input.numberOfChildren??0;const numberOfTravellers=calculateTravellerCount(input.numberOfAdults,numberOfChildren);const clientName=`${input.firstName} ${input.lastName}`.trim();let briitelyContactId:string|null=null;let briitelySyncPending=false;
  try{const existing=await findContactByEmailOrPhone(input.email,input.phone);const contact=await upsertContact({firstName:input.firstName,lastName:input.lastName,email:input.email,phone:input.phone,assignedTo:owner.briitelyUserId||undefined});briitelyContactId=contact.customer.id;if(!existing)await addContactTag(briitelyContactId,NEW_INQUIRY_TAG);for(const tag of resolveIntakeTags(input))await addContactTag(briitelyContactId,tag)}catch(error){console.error("INTAKE_BRIITELY_CONTACT_SYNC_FAILED",error);briitelySyncPending=true}
  if(!briitelyContactId)return{success:false,travelFileId:null,briitelyContactId:null,error:"Could not create or find the Briitely contact.",briitelySyncPending:true};
  const now=new Date().toISOString();
  const{data:file,error:fileError}=await supabase.from("travel_files").insert({briitely_contact_id:briitelyContactId,client_name:clientName,stage:"new_inquiry",stage_changed_at:now,destination:input.destination,trip_type:input.tripType,travel_timeframe:input.travelTimeframe,budget_range:input.budgetRange,number_of_adults:input.numberOfAdults,number_of_children:numberOfChildren,children_ages:input.childrenAges,number_of_travellers:numberOfTravellers,travel_interests:input.travelInterests,travel_seasons:input.travelSeasons,referral_source:input.referralSource||null,referral_detail:input.referralDetail,event_detail:input.eventDetail,special_considerations:input.specialConsiderations,intake_source:input.intakeSource,intake_method:input.intakeMethod,assigned_advisor_id:owner.portalProfileId||null}).select("id").single();
  if(fileError||!file)return{success:false,travelFileId:null,briitelyContactId,error:fileError?.message??"Could not create Travel File.",briitelySyncPending};
  if(input.travelInterests.length||input.travelSeasons.length){await supabase.from("client_travel_profiles").upsert({briitely_contact_id:briitelyContactId,travel_interests:input.travelInterests,travel_seasons:input.travelSeasons},{onConflict:"briitely_contact_id"})}
  if(input.staffNotes&&input.staffUserId)await supabase.from("travel_notes").insert({travel_file_id:file.id,note_type:"staff",note_text:input.staffNotes,created_by:input.staffUserId});
  const{data:action,error:actionError}=await supabase.from("travel_actions").insert({travel_file_id:file.id,action_code:"book_consultation",title:"Book Consultation",action_role:"blocking",responsible_type:"internal",responsible_user_id:owner.portalProfileId||input.staffUserId,status:"active",waiting_since:now,activated_at:now}).select("id").single();
  if(!actionError&&action)await supabase.from("travel_files").update({current_action_id:action.id}).eq("id",file.id);
  await supabase.from("travel_activity").insert({travel_file_id:file.id,event_type:"inquiry_created",summary:`New inquiry created for ${clientName}.`,actor_type:input.intakeSource==="staff"?"internal":"client",actor_user_id:input.staffUserId,previous_stage:null,new_stage:"new_inquiry",metadata:{intake_source:input.intakeSource,intake_method:input.intakeMethod}});
  try{await briitelyRequest({method:"PUT",path:`/contacts/${encodeURIComponent(briitelyContactId)}`,body:{customFields:[]}})}catch(error){console.warn("INTAKE_BRIITELY_POST_SYNC_FAILED",error);briitelySyncPending=true}
  return{success:true,travelFileId:file.id,briitelyContactId,error:null,briitelySyncPending};
}
