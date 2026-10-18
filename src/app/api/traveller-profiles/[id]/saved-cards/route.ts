import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
type Context={params:Promise<{id:string}>};
async function setup(params:Context["params"]){
 const {user}=await getAuthenticatedUser();
 if(!user?.isActive||!["staff","admin","super_admin"].includes(user.role))throw new Error("Unauthorized");
 const {id}=await params;
 const db=createServiceClient();
 if(!db)throw new Error("Service unavailable");
 return {id,db};
}
export async function GET(_req:Request,{params}:Context){
 try{const {id,db}=await setup(params);const {data,error}=await db.from("traveller_saved_card_references").select("id,card_brand,last_four,label,is_preferred").eq("traveller_profile_id",id).order("created_at");if(error)throw error;return NextResponse.json({cards:data??[]})}catch{return NextResponse.json({error:"Could not load saved card references."},{status:403})}
}
export async function POST(req:Request,{params}:Context){
 try{const {id,db}=await setup(params);const b=await req.json();if(!["Visa","Mastercard","American Express","Discover","Other"].includes(b.cardBrand)||typeof b.lastFour!=="string"||!/^[0-9]{4}$/.test(b.lastFour)||typeof b.label!=="string"||b.label.length>80)return NextResponse.json({error:"Invalid card reference."},{status:400});
 const {error}=await db.from("traveller_saved_card_references").insert({traveller_profile_id:id,card_brand:b.cardBrand,last_four:b.lastFour,label:b.label.trim(),is_preferred:false});if(error)throw error;return NextResponse.json({ok:true})}catch{return NextResponse.json({error:"Could not add card reference."},{status:403})}
}
export async function PATCH(req:Request,{params}:Context){
 try{const {id,db}=await setup(params);const b=await req.json();if(typeof b.cardId!=="string")return NextResponse.json({error:"Card required."},{status:400});
 const {data:card}=await db.from("traveller_saved_card_references").select("id").eq("id",b.cardId).eq("traveller_profile_id",id).maybeSingle();if(!card)return NextResponse.json({error:"Card not found."},{status:404});
 if(b.prefer===true){const {error:e}=await db.from("traveller_saved_card_references").update({is_preferred:false}).eq("traveller_profile_id",id).eq("is_preferred",true);if(e)throw e;const {error}=await db.from("traveller_saved_card_references").update({is_preferred:true}).eq("id",card.id);if(error)throw error;}
 else{if(!["Visa","Mastercard","American Express","Discover","Other"].includes(b.cardBrand)||typeof b.lastFour!=="string"||!/^[0-9]{4}$/.test(b.lastFour)||typeof b.label!=="string"||b.label.length>80)return NextResponse.json({error:"Invalid card reference."},{status:400});const {error}=await db.from("traveller_saved_card_references").update({card_brand:b.cardBrand,last_four:b.lastFour,label:b.label.trim()}).eq("id",card.id);if(error)throw error;}
 return NextResponse.json({ok:true})}catch{return NextResponse.json({error:"Could not update card reference."},{status:403})}
}
export async function DELETE(req:Request,{params}:Context){
 try{const {id,db}=await setup(params);const b=await req.json();if(typeof b.cardId!=="string")return NextResponse.json({error:"Card required."},{status:400});const {error}=await db.from("traveller_saved_card_references").delete().eq("id",b.cardId).eq("traveller_profile_id",id);if(error)throw error;return NextResponse.json({ok:true})}catch{return NextResponse.json({error:"Could not remove card reference."},{status:403})}
}
