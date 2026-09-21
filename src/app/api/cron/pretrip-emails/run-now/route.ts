import{NextResponse}from"next/server";import{getAuthenticatedUser}from"@/lib/supabase/auth";import{GET as runPretripCron}from"../route";
export async function POST(request:Request){
 const{user}=await getAuthenticatedUser();if(!user||!user.isActive)return NextResponse.json({error:"Authentication required."},{status:401});if(!["admin","super_admin"].includes(user.role))return NextResponse.json({error:"Admin access required."},{status:403});
 const secret=process.env.CRON_SECRET?.trim();const cronRequest=new Request(request.url,{method:"GET",headers:secret?{Authorization:`Bearer ${secret}`}:{}});
 const response=await runPretripCron(cronRequest),data=await response.json().catch(()=>({}));return NextResponse.json(data,{status:response.status});
}