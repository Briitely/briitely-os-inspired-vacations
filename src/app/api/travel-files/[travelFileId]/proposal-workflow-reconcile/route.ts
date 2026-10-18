import {NextResponse} from "next/server";
import {getAuthenticatedUser} from "@/lib/supabase/auth";
import {advanceProposalWorkflow,proposalWorkflowStatus} from "@/lib/travel/proposal-workflow";

export async function POST(_request:Request,{params}:{params:Promise<{travelFileId:string}>}){
 const {user}=await getAuthenticatedUser();
 if(!user?.isActive)return NextResponse.json({error:"Authentication required."},{status:401});
 if(!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});
 const {travelFileId}=await params;
 try{
  const before=await proposalWorkflowStatus(travelFileId);
  if(!before.agreementComplete||!before.preferencesComplete)return NextResponse.json({advanced:false,agreementComplete:before.agreementComplete,preferencesComplete:before.preferencesComplete,message:"Both submissions are required."},{status:409});
  const advanced=await advanceProposalWorkflow(travelFileId);
  return NextResponse.json({advanced,alreadyAdvanced:before.action?.action_code!=="await_proposal_acceptance"});
 }catch(error){
  console.error("PROPOSAL_WORKFLOW_RECONCILE_FAILED",error);
  return NextResponse.json({error:error instanceof Error?error.message:"Could not complete proposal workflow."},{status:500});
 }
}
