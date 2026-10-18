import {NextResponse} from "next/server";
import {getAuthenticatedUser} from "@/lib/supabase/auth";
import {createServiceClient} from "@/lib/supabase/service";

function nextBusinessDay(value:Date){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Edmonton",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);
 const n=(key:string)=>Number(parts.find(p=>p.type===key)?.value);
 const next=new Date(Date.UTC(n("year"),n("month")-1,n("day")+1,12));
 while(next.getUTCDay()===0||next.getUTCDay()===6)next.setUTCDate(next.getUTCDate()+1);
 return new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth(),next.getUTCDate(),23)).toISOString();
}
export async function POST(_request:Request,{params}:{params:Promise<{travelFileId:string}>}){
 const {user}=await getAuthenticatedUser();
 if(!user?.isActive||!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});
 const {travelFileId}=await params,db=createServiceClient();
 if(!db)return NextResponse.json({error:"Workflow service unavailable."},{status:500});
 const {data:file}=await db.from("travel_files").select("current_action_id").eq("id",travelFileId).maybeSingle();
 if(!file?.current_action_id)return NextResponse.json({error:"Current action not found."},{status:404});
 const {data:action}=await db.from("travel_actions").select("id,action_code,status,activated_at,created_at,metadata").eq("id",file.current_action_id).eq("travel_file_id",travelFileId).maybeSingle();
 if(!action||action.action_code!=="collect_deposit"||action.status!=="active")return NextResponse.json({error:"Process Deposit is not the active action."},{status:409});
 if((action.metadata as Record<string,unknown>|null)?.trigger!=="proposal_agreement_and_preferences_completed")return NextResponse.json({error:"This action was not created by the proposal workflow."},{status:409});
 const {data:dana}=await db.from("profiles").select("id").eq("id","57c99ca4-6128-4920-9d69-744f85cc514b").eq("is_active",true).maybeSingle();
 if(!dana)return NextResponse.json({error:"Dana's active team profile was not found."},{status:409});
 const dueAt=nextBusinessDay(new Date(action.activated_at??action.created_at));
 const {error}=await db.from("travel_actions").update({responsible_type:"internal",responsible_user_id:dana.id,due_at:dueAt,waiting_since:null}).eq("id",action.id).eq("status","active");
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({assignedTo:dana.id,dueAt});
}
