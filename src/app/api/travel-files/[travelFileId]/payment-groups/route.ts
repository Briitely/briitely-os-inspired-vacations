import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getContact } from "@/lib/briitely/contacts";
import { assignUnassignedPaymentsToPrimaryGroup } from "@/lib/travel/payment-groups";
import { syncPaymentBatchTask } from "@/lib/travel/payment-tasks";

async function context() {
  const { user } = await getAuthenticatedUser();
  if (!user || !user.isActive || !["staff", "admin", "super_admin"].includes(user.role)) return null;
  return { db: await createClient() };
}

function profile(member: any) {
  return Array.isArray(member?.traveller_profiles) ? member.traveller_profiles[0] : member?.traveller_profiles;
}

export async function GET(_request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { travelFileId } = await params;
  await assignUnassignedPaymentsToPrimaryGroup(ctx.db, travelFileId);
  const [{ data: party, error: partyError }, { data: groups, error: groupError }] = await Promise.all([
    ctx.db.from("travel_file_travellers").select("id,traveller_role,traveller_profiles:traveller_profile_id(first_name,last_name,preferred_name,email,briitely_contact_id)").eq("travel_file_id", travelFileId).order("created_at", { ascending: true }),
    ctx.db.from("travel_payment_groups").select("id,label,payment_email_recipient_traveller_id,travel_payment_group_travellers(travel_file_traveller_id)").eq("travel_file_id", travelFileId).order("created_at", { ascending: true }),
  ]);
  if (partyError || groupError) return NextResponse.json({ error: partyError?.message ?? groupError?.message ?? "Could not load payment groups." }, { status: 500 });
  const travellers = await Promise.all((party ?? []).map(async (member: any) => {
    const p = profile(member);
    let email = p?.email?.trim() || null;
    if (!email && p?.briitely_contact_id) {
      try { email = (await getContact(p.briitely_contact_id)).email?.trim() || null; } catch {}
    }
    return { id: member.id, name: [p?.preferred_name || p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Traveller", email, isPrimary: member.traveller_role === "primary" };
  }));
  const normalizedGroups = (groups ?? []).map((group: any) => ({
    id: group.id,
    label: group.label ?? "",
    paymentEmailRecipientTravellerId: group.payment_email_recipient_traveller_id ?? "",
    travellerIds: (group.travel_payment_group_travellers ?? []).map((link: any) => link.travel_file_traveller_id),
  }));
  return NextResponse.json({ travellers, groups: normalizedGroups });
}

export async function POST(request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { travelFileId } = await params;
  const body = await request.json().catch(() => null) as { label?: string; travellerIds?: string[]; paymentEmailRecipientTravellerId?: string } | null;
  const travellerIds = Array.from(new Set((body?.travellerIds ?? []).filter(Boolean)));
  if (!travellerIds.length) return NextResponse.json({ error: "Choose at least one traveller for this booking group." }, { status: 400 });
  const recipientId = body?.paymentEmailRecipientTravellerId?.trim() || "";
  if (!recipientId || !travellerIds.includes(recipientId)) return NextResponse.json({ error: "Choose a payment email recipient from the travellers in this booking group." }, { status: 400 });
  const { data: validTravellers, error: travellerError } = await ctx.db.from("travel_file_travellers").select("id,traveller_profiles:traveller_profile_id(email)").eq("travel_file_id", travelFileId).in("id", travellerIds);
  if (travellerError || (validTravellers ?? []).length !== travellerIds.length) return NextResponse.json({ error: "One or more selected travellers are not on this Travel File." }, { status: 400 });
  const recipient = (validTravellers ?? []).find((t:any)=>t.id===recipientId);const recipientProfile=Array.isArray(recipient?.traveller_profiles)?recipient.traveller_profiles[0]:recipient?.traveller_profiles;if(!recipientProfile?.email?.trim())return NextResponse.json({error:"The payment email recipient must have an email address on file."},{status:400});
  const { data: group, error } = await ctx.db.from("travel_payment_groups").insert({ travel_file_id: travelFileId, label: body?.label?.trim() || null, payment_email_recipient_traveller_id: recipientId }).select("id,label,payment_email_recipient_traveller_id").single();
  if (error || !group) return NextResponse.json({ error: error?.message ?? "Could not create booking group." }, { status: 500 });
  const { error: linkError } = await ctx.db.from("travel_payment_group_travellers").insert(travellerIds.map((id) => ({ payment_group_id: group.id, travel_file_traveller_id: id })));
  if (linkError) {
    await ctx.db.from("travel_payment_groups").delete().eq("id", group.id);
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }
  return NextResponse.json({ group: { id: group.id, label: group.label ?? "", travellerIds, paymentEmailRecipientTravellerId: group.payment_email_recipient_traveller_id ?? "" } }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ travelFileId: string }> }) {
  const ctx = await context(); if (!ctx) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { travelFileId } = await params;
  const body = await request.json().catch(() => null) as { groupId?: string; label?: string; travellerIds?: string[]; paymentEmailRecipientTravellerId?: string } | null;
  const groupId=body?.groupId?.trim(),travellerIds=Array.from(new Set((body?.travellerIds??[]).filter(Boolean))),recipientId=body?.paymentEmailRecipientTravellerId?.trim()||"";
  if(!groupId)return NextResponse.json({error:"Booking group is required."},{status:400});
  if(!travellerIds.length)return NextResponse.json({error:"Choose at least one traveller for this booking group."},{status:400});
  if(!recipientId||!travellerIds.includes(recipientId))return NextResponse.json({error:"Choose a payment email recipient from the travellers in this booking group."},{status:400});
  const {data:valid,error:travellerError}=await ctx.db.from("travel_file_travellers").select("id,traveller_profiles:traveller_profile_id(email)").eq("travel_file_id",travelFileId).in("id",travellerIds);
  if(travellerError||(valid??[]).length!==travellerIds.length)return NextResponse.json({error:"One or more selected travellers are not on this Travel File."},{status:400});
  const recipient=(valid??[]).find((t:any)=>t.id===recipientId),p=Array.isArray(recipient?.traveller_profiles)?recipient.traveller_profiles[0]:recipient?.traveller_profiles;
  if(!p?.email?.trim())return NextResponse.json({error:"The payment email recipient must have an email address on file."},{status:400});
  const {data:existingGroup}=await ctx.db.from("travel_payment_groups").select("label").eq("id",groupId).eq("travel_file_id",travelFileId).maybeSingle();const oldLabel=existingGroup?.label?.trim()||"Booking Group",newLabel=body?.label?.trim()||"Booking Group";
  const {data:group,error}=await ctx.db.from("travel_payment_groups").update({label:body?.label?.trim()||null,payment_email_recipient_traveller_id:recipientId}).eq("id",groupId).eq("travel_file_id",travelFileId).select("id,label,payment_email_recipient_traveller_id").single();
  if(error||!group)return NextResponse.json({error:error?.message??"Could not update booking group."},{status:500});
  const {error:deleteError}=await ctx.db.from("travel_payment_group_travellers").delete().eq("payment_group_id",groupId);if(deleteError)return NextResponse.json({error:deleteError.message},{status:500});
  const {error:linkError}=await ctx.db.from("travel_payment_group_travellers").insert(travellerIds.map(id=>({payment_group_id:groupId,travel_file_traveller_id:id})));if(linkError)return NextResponse.json({error:linkError.message},{status:500});
  const {data:paymentDates}=await ctx.db.from("travel_payments").select("due_date").eq("travel_file_id",travelFileId).eq("payment_group_id",groupId).not("due_date","is",null);for(const dueDate of Array.from(new Set((paymentDates??[]).map((row:any)=>row.due_date).filter(Boolean)))){const d=dueDate as string;if(oldLabel!==newLabel){const dateLabel=new Date(`${d}T12:00:00Z`).toLocaleDateString("en-CA",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}),oldTitle=`Payments due — ${dateLabel} — ${oldLabel}`,newTitle=`Payments due — ${dateLabel} — ${newLabel}`;const [{data:oldTasks},{data:newTasks}]=await Promise.all([ctx.db.from("travel_file_tasks").select("id,status").eq("travel_file_id",travelFileId).eq("title",oldTitle),ctx.db.from("travel_file_tasks").select("id,status").eq("travel_file_id",travelFileId).eq("title",newTitle)]);const openOld=(oldTasks??[]).filter((t:any)=>t.status!=="complete"),openNew=(newTasks??[]).filter((t:any)=>t.status!=="complete");if(openOld.length){if(openNew.length){await ctx.db.from("travel_file_tasks").delete().in("id",openOld.map((t:any)=>t.id))}else{await ctx.db.from("travel_file_tasks").update({title:newTitle,updated_at:new Date().toISOString()}).eq("id",openOld[0].id);if(openOld.length>1)await ctx.db.from("travel_file_tasks").delete().in("id",openOld.slice(1).map((t:any)=>t.id))}}}await syncPaymentBatchTask(ctx.db,travelFileId,d)}
  return NextResponse.json({group:{id:group.id,label:group.label??"",travellerIds,paymentEmailRecipientTravellerId:group.payment_email_recipient_traveller_id??""}});
}
