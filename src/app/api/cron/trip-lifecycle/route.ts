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
   const{data:current}=file.current_action_id?await db.from("travel_actions").select("id,action_code,status").eq("id",file.current_action_id).maybeSingle():{data:null};
   if(!current||current.status!=="active"||!["waiting_for_travel","travelling","pre_trip_actions","post_trip_close_file"].includes(current.action_code)){results.push({travelFileId:file.id,status:"not_ready_for_return_processing"});continue}if(current.action_code==="post_trip_close_file"&&file.client_rollup_recorded_at){results.push({travelFileId:file.id,status:"already_post_trip"});continue}

   // Departure triggers travelling; return triggers post-trip on the following calendar day.
   if(current.action_code==="waiting_for_travel" && file.departure_date && file.departure_date<=today && (!file.return_date || file.return_date>=today)){
    const now=new Date().toISOString();
    const {data:next,error:nextError}=await db.from("travel_actions").insert({travel_file_id:file.id,action_code:"travelling",title:"Travelling",description:"Client is travelling. Automatically advances after the return date.",action_role:"supporting",responsible_type:"system",responsible_user_id:null,due_at:file.return_date?`${file.return_date}T12:00:00Z`:null,status:"active",waiting_since:now,activated_at:now,metadata:{trigger:"departure_date_reached",departure_date:file.departure_date}}).select("id").single();
    if(nextError||!next)throw nextError??new Error("Could not create Travelling action.");
    const {error:fileError}=await db.from("travel_files").update({stage:"travelling",stage_changed_at:now,current_action_id:next.id}).eq("id",file.id).eq("current_action_id",current.id);
    if(fileError)throw fileError;
    await db.from("travel_actions").update({status:"completed",completed_at:now,completion_source:"system",completion_event:"departure_date_reached"}).eq("id",current.id);
    await db.from("travel_activity").insert({travel_file_id:file.id,event_type:"trip_departed",summary:"Departure date reached. Travel File moved to Travelling.",actor_type:"system",actor_user_id:null,action_id:next.id,previous_stage:file.stage,new_stage:"travelling",metadata:{departure_date:file.departure_date}});
    advanced++;results.push({travelFileId:file.id,status:"travelling"});continue;
   }
   if(!file.return_date || file.return_date>=today){results.push({travelFileId:file.id,status:"awaiting_return_plus_one_day"});continue;}
   if(!file.client_rollup_recorded_at){
    const{data:members,error:memberError}=await db.from("travel_file_travellers").select("id,traveller_profiles:traveller_profile_id(briitely_contact_id)").eq("travel_file_id",file.id);
    if(memberError)throw memberError;
    const contactByMember=new Map<string,string>();
    const tripContacts=new Set<string>();
    for(const member of members??[]){const p=Array.isArray(member.traveller_profiles)?member.traveller_profiles[0]:member.traveller_profiles;const contact=p?.briitely_contact_id?.trim();if(contact){contactByMember.set(member.id,contact);tripContacts.add(contact)}}
    const{data:groups,error:groupError}=await db.from("travel_payment_groups").select("id,payment_email_recipient_traveller_id").eq("travel_file_id",file.id);
    if(groupError)throw groupError;
    const groupToContact=new Map<string,string>();
    for(const group of groups??[]){const contact=contactByMember.get(group.payment_email_recipient_traveller_id);if(contact)groupToContact.set(group.id,contact)}
    const{data:payments,error:paymentError}=await db.from("travel_payments").select("payment_group_id,amount,status").eq("travel_file_id",file.id);
    if(paymentError)throw paymentError;
    const values=new Map<string,number>();
    for(const payment of payments??[]){if(payment.status==="cancelled"||!payment.payment_group_id)continue;const contact=groupToContact.get(payment.payment_group_id);if(!contact)continue;values.set(contact,(values.get(contact)??0)+Number(payment.amount??0))}
    for(const contactId of tripContacts){
      const{data:profile,error:profileError}=await db.from("client_travel_profiles").select("id,number_of_trips,lifetime_value").eq("briitely_contact_id",contactId).maybeSingle();
      if(profileError)throw profileError;
      if(profile){const{error:updateError}=await db.from("client_travel_profiles").update({number_of_trips:Number(profile.number_of_trips??0)+1,lifetime_value:Number(profile.lifetime_value??0)+(values.get(contactId)??0),last_travel_destination:file.destination??null,last_travel_date:file.return_date}).eq("id",profile.id);if(updateError)throw updateError}
      else{const{error:insertError}=await db.from("client_travel_profiles").insert({briitely_contact_id:contactId,number_of_trips:1,lifetime_value:values.get(contactId)??0,last_travel_destination:file.destination??null,last_travel_date:file.return_date});if(insertError)throw insertError}
    }
    const rollupAt=new Date().toISOString();const{error:markError}=await db.from("travel_files").update({client_rollup_recorded_at:rollupAt}).eq("id",file.id).is("client_rollup_recorded_at",null);if(markError)throw markError;rolledUp++;
   }

   if(current?.action_code!=="post_trip_close_file"){
    const now=new Date().toISOString();
    const{data:next,error:nextError}=await db.from("travel_actions").insert({travel_file_id:file.id,action_code:"post_trip_close_file",title:"Post-Trip / Close File",description:"Complete any post-trip follow-up, resolve outstanding issues, and close the Travel File.",action_role:"blocking",responsible_type:"internal",responsible_user_id:file.assigned_advisor_id??null,status:"active",waiting_since:now,activated_at:now,metadata:{trigger:"day_after_return",return_date:file.return_date}}).select("id").single();
    if(nextError||!next)throw nextError??new Error("Could not create post-trip action.");
    if(current?.id&&current.status==="active")await db.from("travel_actions").update({status:"completed",completed_at:now,completion_source:"system",completion_event:"return_date_reached"}).eq("id",current.id);
    const{error:fileError}=await db.from("travel_files").update({stage:"post_trip",stage_changed_at:now,current_action_id:next.id}).eq("id",file.id);if(fileError)throw fileError;
    await db.from("travel_activity").insert({travel_file_id:file.id,event_type:"trip_returned",summary:"Day after return date reached. Travel File moved to Post-Trip / Close File.",actor_type:"system",actor_user_id:null,action_id:next.id,previous_stage:file.stage,new_stage:"post_trip",metadata:{return_date:file.return_date}});
    advanced++;
   }
   results.push({travelFileId:file.id,status:"post_trip"});
  }catch(e){failed++;results.push({travelFileId:file.id,status:"failed",error:e instanceof Error?e.message:"Unknown error"})}
 }
 return NextResponse.json({date:today,files:(files??[]).length,advanced,rolledUp,failed,results});
}