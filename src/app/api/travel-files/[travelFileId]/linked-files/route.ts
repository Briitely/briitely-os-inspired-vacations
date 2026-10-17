import {NextResponse} from "next/server";
import {getAuthenticatedUser} from "@/lib/supabase/auth";
import {createServiceClient} from "@/lib/supabase/service";

export async function GET(_request:Request,{params}:{params:Promise<{travelFileId:string}>}){
 const {user}=await getAuthenticatedUser();
 if(!user?.isActive)return NextResponse.json({error:"Authentication required."},{status:401});
 if(!["staff","admin","super_admin"].includes(user.role))return NextResponse.json({error:"Staff access required."},{status:403});
 const {travelFileId}=await params,db=createServiceClient();
 if(!db)return NextResponse.json({error:"Service unavailable."},{status:503});
 const [{data:incoming,error:ie},{data:outgoing,error:oe}]=await Promise.all([
  db.from("travel_file_group_splits").select("source_travel_file_id,recipient_party_member_id").eq("resulting_travel_file_id",travelFileId).maybeSingle(),
  db.from("travel_file_group_splits").select("resulting_travel_file_id,recipient_party_member_id").eq("source_travel_file_id",travelFileId)
 ]);
 if(ie||oe)return NextResponse.json({error:(ie||oe)?.message},{status:500});
 const sourceId=incoming?.source_travel_file_id??travelFileId;
 const {data:siblings,error:se}=await db.from("travel_file_group_splits").select("resulting_travel_file_id,recipient_party_member_id").eq("source_travel_file_id",sourceId);
 if(se)return NextResponse.json({error:se.message},{status:500});
 const ids=[sourceId,...(siblings??[]).map(s=>s.resulting_travel_file_id)];
 if(ids.length===1)return NextResponse.json({linked:false,files:[],movedMemberIds:[]});
 const {data:files,error:fe}=await db.from("travel_files").select("id,client_name").in("id",ids);
 if(fe)return NextResponse.json({error:fe.message},{status:500});
 const movedMemberIds:string[]=[];
 if(sourceId===travelFileId){
  const {data:party,error:pe}=await db.from("travel_file_travellers").select("id,booking_form_recipient_party_member_id").eq("travel_file_id",sourceId);
  if(pe)return NextResponse.json({error:pe.message},{status:500});
  const movedRecipients=new Set((siblings??[]).map(s=>s.recipient_party_member_id));
  for(const member of party??[])if(movedRecipients.has(member.id)||movedRecipients.has(member.booking_form_recipient_party_member_id??""))movedMemberIds.push(member.id);
 }
 const names=new Map((files??[]).map(f=>[f.id,f.client_name]));
 const movedTo=Object.fromEntries((siblings??[]).map(s=>[s.recipient_party_member_id,{id:s.resulting_travel_file_id,name:names.get(s.resulting_travel_file_id)??"Linked Travel File"}]));
 const {data:sourceParty}=sourceId===travelFileId?await db.from("travel_file_travellers").select("id,booking_form_recipient_party_member_id").eq("travel_file_id",sourceId):{data:[]};
 const memberDestinations=Object.fromEntries((sourceParty??[]).flatMap(m=>{const dest=movedTo[m.id]??movedTo[m.booking_form_recipient_party_member_id??""];return dest?[[m.id,dest]]:[]}));
 return NextResponse.json({linked:true,sourceId,files:ids.map(id=>({id,name:names.get(id)??"Travel File",original:id===sourceId,current:id===travelFileId})),movedMemberIds,memberDestinations});
}
