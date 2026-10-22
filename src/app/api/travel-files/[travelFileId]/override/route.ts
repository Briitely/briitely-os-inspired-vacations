import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { jumpToWorkflowStep } from "@/lib/travel/workflow-jump";

interface OverrideBody {actionCode:string;responsibleUserId?:string|null;dueAt?:string|null;retainerAgreementConfirmed?:boolean;}

export async function POST(request:Request,{params}:{params:Promise<{travelFileId:string}>}){
 const{user}=await getAuthenticatedUser();
 if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
 if(user.role!=="admin"&&user.role!=="super_admin")return NextResponse.json({error:"Admin access required."},{status:403});
 const{travelFileId}=await params;
 let body:OverrideBody;
 try{body=await request.json() as OverrideBody}catch{return NextResponse.json({error:"Invalid request body."},{status:400})}
 const supabase=await createClient();
 const result=await jumpToWorkflowStep(supabase,{travelFileId,actionCode:body.actionCode,responsibleUserId:body.responsibleUserId??null,dueAt:body.dueAt??null,retainerAgreementConfirmed:body.retainerAgreementConfirmed,userId:user.id,kind:"override"});
 if(!result.ok)return NextResponse.json({error:result.error},{status:result.status});
 return NextResponse.json({success:true,stage:result.stage,actionId:result.actionId});
}
