import{NextResponse}from"next/server";import{POST as executeScheduledEmail}from"../../travel-files/[travelFileId]/pretrip-email-plan/execute/route";
const TEST_TRAVEL_FILE_ID="fee5243b-23a8-43b9-8a25-030aaecfcf0a";
const TEST_EMAIL_CODE="vaccines_visas";
export async function GET(request:Request){
 const auth=request.headers.get("authorization");
 const secret=process.env.CRON_SECRET?.trim();
 const authPresent=Boolean(auth);
 const bearerPresent=Boolean(auth?.startsWith("Bearer "));
 const secretConfigured=Boolean(secret);
 const authMatches=Boolean(secret&&auth==="Bearer "+secret);
 console.log("PRETRIP_CRON_TEST_AUTH",{authPresent,bearerPresent,secretConfigured,authMatches,userAgent:request.headers.get("user-agent")});
 if(!secret||!authMatches)return NextResponse.json({error:"Cron authorization failed.",diagnostics:{authPresent,bearerPresent,secretConfigured,authMatches,userAgent:request.headers.get("user-agent")}}, {status:401});
 const executionSecret=process.env.PRETRIP_EMAIL_EXECUTION_SECRET?.trim();
 if(!executionSecret)return NextResponse.json({error:"PRETRIP_EMAIL_EXECUTION_SECRET is not configured.",diagnostics:{cronAuth:"passed"}},{status:500});
 console.log("PRETRIP_CRON_TEST_EXECUTE",{travelFileId:TEST_TRAVEL_FILE_ID,emailCode:TEST_EMAIL_CODE,executionSecretConfigured:true});
 const executionRequest=new Request(request.url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${executionSecret}`},body:JSON.stringify({email_code:TEST_EMAIL_CODE})});
 const response=await executeScheduledEmail(executionRequest,{params:Promise.resolve({travelFileId:TEST_TRAVEL_FILE_ID})});
 const data=await response.json().catch(()=>({}));
 console.log("PRETRIP_CRON_TEST_RESULT",{status:response.status,ok:response.ok,result:data});
 return NextResponse.json({test:true,travelFileId:TEST_TRAVEL_FILE_ID,emailCode:TEST_EMAIL_CODE,executionStatus:response.status,result:data},{status:response.ok?200:response.status});
}
