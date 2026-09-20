import{NextResponse}from"next/server";import{getAuthenticatedUser}from"@/lib/supabase/auth";import{POST as executeScheduledEmail}from"../execute/route";
export async function POST(request:Request,{params}:{params:Promise<{travelFileId:string}>}){
 const{user}=await getAuthenticatedUser();if(!user||!user.isActive)return NextResponse.json({error:"Authentication required."},{status:401});if(!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});
 const{travelFileId}=await params,body=await request.json().catch(()=>null)as{email_code?:string}|null,code=body?.email_code?.trim(),secret=process.env.PRETRIP_EMAIL_EXECUTION_SECRET?.trim();if(!code)return NextResponse.json({error:"Email code is required."},{status:400});if(!secret)return NextResponse.json({error:"PRETRIP_EMAIL_EXECUTION_SECRET is not configured."},{status:500});
 const cookie=request.headers.get("cookie")??"";const executionRequest=new Request(request.url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${secret}`,cookie},body:JSON.stringify({email_code:code,test:true})});
 const response=await executeScheduledEmail(executionRequest,{params:Promise.resolve({travelFileId})}),data=await response.json().catch(()=>({}));
 if(!response.ok)return NextResponse.json(data,{status:response.status});
 if(!data.test)return NextResponse.json({error:"Test execution did not run in test mode."},{status:500});
 return NextResponse.json(data);
}