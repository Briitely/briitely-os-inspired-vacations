import{NextResponse}from"next/server";import{POST as executeScheduledEmail}from"../../travel-files/[travelFileId]/pretrip-email-plan/execute/route";
const TEST_TRAVEL_FILE_ID="fee5243b-23a8-43b9-8a25-030aaecfcf0a";
const TEST_EMAIL_CODE="vaccines_visas";
export async function GET(request:Request){
 const auth=request.headers.get("authorization"),secret=process.env.CRON_SECRET?.trim();
 if(!secret||auth!=="Bearer "+secret)return NextResponse.json({error:"Unauthorized."},{status:401});
 const executionSecret=process.env.PRETRIP_EMAIL_EXECUTION_SECRET?.trim();
 if(!executionSecret)return NextResponse.json({error:"PRETRIP_EMAIL_EXECUTION_SECRET is not configured."},{status:500});
 const executionRequest=new Request(request.url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${executionSecret}`},body:JSON.stringify({email_code:TEST_EMAIL_CODE})});
 const response=await executeScheduledEmail(executionRequest,{params:Promise.resolve({travelFileId:TEST_TRAVEL_FILE_ID})});
 const data=await response.json().catch(()=>({}));
 return NextResponse.json({test:true,travelFileId:TEST_TRAVEL_FILE_ID,emailCode:TEST_EMAIL_CODE,executionStatus:response.status,result:data},{status:response.ok?200:response.status});
}
