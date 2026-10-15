import{NextResponse}from"next/server";
import{createClient as createSupabaseClient}from"@supabase/supabase-js";

function todayKey(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Edmonton",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}

export async function GET(request:Request){
 const auth=request.headers.get("authorization"),secret=process.env.CRON_SECRET?.trim();
 if(!secret||auth!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized."},{status:401});
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
 if(!serviceKey||!url)return NextResponse.json({error:"Trip lifecycle scheduler is not configured."},{status:500});
 const db=createSupabaseClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}),today=todayKey();
 const{data:files,error}=await db.from("travel_files").select("id,destination,departure_date,return_date,stage,current_action_id,assigned_advisor_id,client_rollup_recorded_at").eq("file_status","open").or(`departure_date.lte.${today},return_date.lt.${today}`);
 if(error)return NextResponse.json({error:error.message},{status:500});
 let advanced=0,rolledUp=0,failed=0;const results:any[]=[];
 for(const file of files??[]){
  try{
   const{data:current,error:currentError}=file.current_action_id?await db.from("travel_actions").select("id,action_code,status").eq("id",file.current_action_id).maybeSingle():{data:null,error:null};if(currentError)throw currentError;
   if(!current||current.status!=="active"||!["waiting_for_travel","travelling","pre_trip_actions","post_trip_close_file"].includes(current.action_code)){results.push({travelFileId:file.id,status:"not_ready_for_return_processing"});continue}if(current.action_code==="post_trip_close_file"&&file.client_rollup_recorded_at){results.push({travelFileId:file.id,status:"already_post_trip"});continue}

   // Departure triggers travelling; return triggers post-trip on the following calendar day.
   if(current.action_code==="waiting_for_travel" && file.departure_date && file.departure_date<=today && (!file.return_date || file.return_date>=today)){
    const now=new Date().toISOString();
    const {data:next,error:nextError}=await db.from("travel_actions").insert({travel_file_id:file.id,action_code:"travelling",title:"Travelling",description:"Client is travelling. Automatically advances after the return date.",action_role:"supporting",responsible_type:"system",responsible_user_id:null,due_at:file.return_date?`${file.return_date}T12:00:00Z`:null,status:"active",waiting_since:now,activated_at:now,metadata:{trigger:"departure_date_reached",departure_date:file.departure_date}}).select("id").single();
    if(nextError||!next)throw nextError??new Error("Could not create Travelling action.");
    const {data:swapped,error:fileError}=await db.from("travel_files").update({stage:"travelling",stage_changed_at:now,current_action_id:next.id}).eq("id",file.id).eq("current_action_id",current.id).eq("file_status","open").select("id").maybeSingle();
    if(fileError||!swapped){await db.from("travel_actions").delete().eq("id",next.id);if(fileError)throw fileError;results.push({travelFileId:file.id,status:"concurrent_transition_skipped"});continue;}
    const {data:claimed,error:claimError}=await db.from("travel_files").select("id").eq("id",file.id).eq("current_action_id",next.id).maybeSingle();
    if(claimError||!claimed){await db.from("travel_actions").delete().eq("id",next.id);if(claimError)throw claimError;results.push({travelFileId:file.id,status:"concurrent_transition_skipped"});continue;}
    const {error:completeError}=await db.from("travel_actions").update({status:"completed",completed_at:now,completion_source:"system",completion_event:"departure_date_reached"}).eq("id",current.id).eq("status","active");if(completeError)throw completeError;
    await db.from("travel_activity").insert({travel_file_id:file.id,event_type:"trip_departed",summary:"Departure date reached. Travel File moved to Travelling.",actor_type:"system",actor_user_id:null,action_id:next.id,previous_stage:file.stage,new_stage:"travelling",metadata:{departure_date:file.departure_date}});
    advanced++;results.push({travelFileId:file.id,status:"travelling"});continue;
   }
   if(!file.return_date || file.return_date>=today){results.push({travelFileId:file.id,status:"awaiting_return_plus_one_day"});continue;}
   // The database function locks the file and commits every profile increment together.
   // Concurrent cron runs return false rather than counting the same trip twice.
   if(!file.client_rollup_recorded_at){
    const{data:recorded,error:rollupError}=await db.rpc("record_travel_file_trip_history",{p_travel_file_id:file.id});
    if(rollupError)throw rollupError;
    if(recorded)rolledUp++;
   }

   if(current?.action_code!=="post_trip_close_file"){
    const now=new Date().toISOString();
    const{data:next,error:nextError}=await db.from("travel_actions").insert({travel_file_id:file.id,action_code:"post_trip_close_file",title:"Post-Trip / Close File",description:"Complete any post-trip follow-up, resolve outstanding issues, and close the Travel File.",action_role:"blocking",responsible_type:"internal",responsible_user_id:file.assigned_advisor_id??null,status:"active",waiting_since:now,activated_at:now,metadata:{trigger:"day_after_return",return_date:file.return_date}}).select("id").single();
    if(nextError||!next)throw nextError??new Error("Could not create post-trip action.");
    const{data:swapped,error:fileError}=await db.from("travel_files").update({stage:"post_trip",stage_changed_at:now,current_action_id:next.id}).eq("id",file.id).eq("current_action_id",current.id).eq("file_status","open").select("id").maybeSingle();
    if(fileError||!swapped){await db.from("travel_actions").delete().eq("id",next.id);if(fileError)throw fileError;results.push({travelFileId:file.id,status:"concurrent_transition_skipped"});continue;}
    const{error:completeError}=await db.from("travel_actions").update({status:"completed",completed_at:now,completion_source:"system",completion_event:"return_date_reached"}).eq("id",current.id).eq("status","active");if(completeError)throw completeError;
    await db.from("travel_activity").insert({travel_file_id:file.id,event_type:"trip_returned",summary:"Day after return date reached. Travel File moved to Post-Trip / Close File.",actor_type:"system",actor_user_id:null,action_id:next.id,previous_stage:file.stage,new_stage:"post_trip",metadata:{return_date:file.return_date}});
    advanced++;
   }
   results.push({travelFileId:file.id,status:"post_trip"});
  }catch(e){failed++;results.push({travelFileId:file.id,status:"failed",error:e instanceof Error?e.message:"Unknown error"})}
 }
 return NextResponse.json({date:today,files:(files??[]).length,advanced,rolledUp,failed,results});
}