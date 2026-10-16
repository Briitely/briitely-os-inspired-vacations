import {NextResponse} from "next/server";
import {createServiceClient} from "@/lib/supabase/service";

/** Receives an appointment-cancelled event from Briitely. Requires appointment ID
 * to avoid resetting a different trip or a rebooked appointment. */
function pick(body:Record<string,unknown>,key:string):string {
 const direct=body[key],custom=body.customData&&typeof body.customData==="object"?(body.customData as Record<string,unknown>)[key]:null;
 return typeof direct==="string"&&direct.trim()?direct.trim():typeof custom==="string"?custom.trim():"";
}
function equals(a:string,b:string){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
export async function POST(request:Request){
 const secret=process.env.BRIITELY_PORTAL_WEBHOOK_SECRET;
 if(!secret)return NextResponse.json({error:"Webhook secret not configured"},{status:500});
 const provided=request.headers.get("x-briitely-webhook-secret")??"";
 if(!equals(provided,secret))return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid payload"},{status:400});
 const payload=body as Record<string,unknown>,contactId=pick(payload,"contactId"),appointmentId=pick(payload,"appointmentId");
 if(!contactId||!appointmentId)return NextResponse.json({error:"contactId and appointmentId are required"},{status:400});
 const db=createServiceClient();if(!db)return NextResponse.json({error:"Database unavailable"},{status:500});
 // The current consultation action stores the appointment ID in metadata.
 // Query by contact and stage first, then compare IDs exactly.
 const {data:files,error:filesError}=await db.from("travel_files").select("id,current_action_id,stage,briitely_contact_id")
   .eq("briitely_contact_id",contactId).eq("file_status","open").eq("stage","consult_booked");
 if(filesError)return NextResponse.json({error:filesError.message},{status:500});
 const actionIds=(files??[]).map(f=>f.current_action_id).filter((id):id is string=>Boolean(id));
 const {data:actions,error:actionsError}=actionIds.length?await db.from("travel_actions").select("id,travel_file_id,action_code,status,metadata").in("id",actionIds):{data:[],error:null};
 if(actionsError)return NextResponse.json({error:actionsError.message},{status:500});
 const matches=(actions??[]).filter(a=>a.action_code==="complete_initial_consultation"&&a.status==="active"&&a.metadata?.appointmentId===appointmentId);
 if(matches.length===0){console.info("BRIITELY_CONSULTATION_CANCELLED",{stage:"no_current_appointment_match",contactId,appointmentId});return NextResponse.json({success:true,result:"no_matching_current_appointment"});}
 if(matches.length!==1)return NextResponse.json({error:"ambiguous_appointment_match"},{status:409});
 const action=matches[0],file=(files??[]).find(f=>f.id===action.travel_file_id);
 if(!file)return NextResponse.json({error:"Travel File not found"},{status:404});
 const now=new Date().toISOString();
 // Restore the original booking action when available, otherwise create one.
 const {data:prior,error:priorError}=await db.from("travel_actions").select("id")
   .eq("travel_file_id",file.id).eq("action_code","book_initial_consultation").order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(priorError)return NextResponse.json({error:priorError.message},{status:500});
 let bookingActionId=prior?.id as string|undefined;
 if(bookingActionId){
  const {error}=await db.from("travel_actions").update({status:"active",completed_at:null,completion_source:null,completion_event:null,activated_at:now,waiting_since:now}).eq("id",bookingActionId);
  if(error)return NextResponse.json({error:error.message},{status:500});
 }else{
  const {data:created,error}=await db.from("travel_actions").insert({travel_file_id:file.id,action_code:"book_initial_consultation",title:"Book initial consultation",action_role:"blocking",responsible_type:"client",status:"active",activated_at:now,waiting_since:now}).select("id").single();
  if(error||!created)return NextResponse.json({error:error?.message??"Could not restore booking action"},{status:500});
  bookingActionId=created.id;
 }
 const {error:fileError}=await db.from("travel_files").update({stage:"new_inquiry",stage_changed_at:now,current_action_id:bookingActionId}).eq("id",file.id).eq("stage","consult_booked").eq("current_action_id",action.id);
 if(fileError)return NextResponse.json({error:fileError.message},{status:500});
 const {error:actionError}=await db.from("travel_actions").update({status:"skipped",completed_at:now,completion_source:"briitely",completion_event:"consultation_cancelled"}).eq("id",action.id);
 if(actionError)console.error("BRIITELY_CONSULTATION_CANCELLED_ACTION_CLEANUP_FAILED",{actionId:action.id,error:actionError.message});
 console.info("BRIITELY_CONSULTATION_CANCELLED",{stage:"reverted",travelFileId:file.id,appointmentId});
 return NextResponse.json({success:true,result:"reverted_to_new_inquiry",travelFileId:file.id});
}
