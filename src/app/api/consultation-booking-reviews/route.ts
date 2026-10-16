import {NextResponse} from "next/server";
import {getAuthenticatedUser} from "@/lib/supabase/auth";
import {createServiceClient} from "@/lib/supabase/service";
import {processConsultationBooking} from "@/app/api/integrations/briitely/consultation-booked/route";

export async function GET(){
 const {user}=await getAuthenticatedUser();if(!user?.isActive)return NextResponse.json({error:"Unauthorized"},{status:401});
 const db=createServiceClient();if(!db)return NextResponse.json({error:"Database unavailable"},{status:500});
 const {data,error}=await db.from("consultation_booking_reviews").select("id,contact_id,appointment_id,client_name,appointment_start,candidate_file_ids,created_at").eq("status","pending").order("created_at",{ascending:true});
 if(error)return NextResponse.json({error:error.message},{status:500});
 const ids=[...new Set((data??[]).flatMap(r=>r.candidate_file_ids??[]))];
 const {data:files,error:filesError}=ids.length?await db.from("travel_files").select("id,client_name,destination,stage,file_status,briitely_contact_id").in("id",ids):{data:[],error:null};
 if(filesError)return NextResponse.json({error:filesError.message},{status:500});
 return NextResponse.json({reviews:(data??[]).map(r=>({...r,files:(files??[]).filter(f=>(r.candidate_file_ids??[]).includes(f.id))}))});
}
export async function POST(request:Request){
 const {user}=await getAuthenticatedUser();if(!user?.isActive)return NextResponse.json({error:"Unauthorized"},{status:401});
 const db=createServiceClient();if(!db)return NextResponse.json({error:"Database unavailable"},{status:500});
 const body=await request.json().catch(()=>null);
 if(!body||typeof body.reviewId!=="string"||typeof body.travelFileId!=="string")return NextResponse.json({error:"Review and Travel File are required."},{status:400});
 const {data:review,error}=await db.from("consultation_booking_reviews").select("*").eq("id",body.reviewId).eq("status","pending").maybeSingle();
 if(error||!review)return NextResponse.json({error:"Pending review not found."},{status:404});
 if(!(review.candidate_file_ids??[]).includes(body.travelFileId))return NextResponse.json({error:"Travel File is not one of the original candidates."},{status:409});
 const {data:file}=await db.from("travel_files").select("id,stage,file_status,briitely_contact_id").eq("id",body.travelFileId).maybeSingle();
 if(!file||file.file_status!=="open"||!["new_inquiry","consult_booked"].includes(file.stage)||file.briitely_contact_id!==review.contact_id)return NextResponse.json({error:"Selected Travel File is no longer eligible."},{status:409});
 const secret=process.env.BRIITELY_PORTAL_WEBHOOK_SECRET;if(!secret)return NextResponse.json({error:"Webhook configuration unavailable"},{status:500});
 const replay=new Request(new URL("/api/integrations/briitely/consultation-booked",request.url),{method:"POST",headers:{"Content-Type":"application/json","x-briitely-webhook-secret":secret},body:JSON.stringify(review.booking_payload)});
 const result=await processConsultationBooking(replay,body.travelFileId);
 if(!result.ok)return result;
 const response=await result.json();
 const {error:updateError}=await db.from("consultation_booking_reviews").update({status:"resolved",resolved_file_id:body.travelFileId,resolved_by:user.id,resolved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",review.id).eq("status","pending");
 if(updateError)return NextResponse.json({error:"Consultation advanced, but the review could not be closed. Refresh before retrying."},{status:500});
 return NextResponse.json({success:true,result:response});
}
