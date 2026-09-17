import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { SharedFooter } from "@/components/app/shared-footer";
import { TravelFileActions } from "@/components/app/travel-file-actions";
import { CurrentActionControl } from "@/components/app/current-action-control";
import { CurrentActionSection } from "@/components/app/travel-file-current-action-section";
import { TravelFileTasks } from "@/components/app/travel-file-tasks";
import { PaymentsSection } from "@/components/app/payments-section";
import { TravelFileSectionEditor } from "@/components/app/travel-file-section-editor";
import { TravelNotesSection } from "@/components/app/travel-notes-section";
import { TravelPartyCard } from "@/components/app/travel-party-card";
import { AssignmentSection, InsuranceSection, TripDetailsSection } from "@/components/app/travel-file-basic-sections";
import { BookingPlanningSection, InquiryDetailsSection, RetainerDetailsSection } from "@/components/app/travel-file-planning-sections";
import { ActionHistorySection, ActivityHistorySection, ConsultationHistorySection } from "@/components/app/travel-file-history-sections";
import { TravelFilePanel as Panel } from "@/components/app/travel-file-display";
import { getContact } from "@/lib/briitely/contacts";
import { Badge } from "@/components/core/ui/badge";
import { Button } from "@/components/core/ui/button";
import { formatStageLabel, formatStageBadgeVariant } from "@/lib/travel/stage-labels";
import { formatDateOnly } from "@/lib/travel/format";
import type { TravelFile, TravelAction, TravelConsultation, TravelActivity } from "@/lib/travel/types";
export const metadata:Metadata={title:"Travel File — Inspired Vacations"};
export default async function TravelFilePage({params}:{params:Promise<{id:string}>}){const{user,error:authError}=await getAuthenticatedUser();if(authError||!user)redirect("/login?redirect=/dashboard");const{id}=await params,supabase=await createClient();const{data:rawFile,error:fileError}=await supabase.from("travel_files").select(`*, current_action:travel_actions!current_action_id (*), assigned_advisor:profiles!assigned_advisor_id (id, full_name)`).eq("id",id).maybeSingle();if(fileError||!rawFile)return <div className="min-h-screen"><DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role}/><main className="mx-auto max-w-6xl p-6"><Panel>Travel File not found.</Panel></main></div>;const file=rawFile as unknown as TravelFile&{current_action:TravelAction|null;assigned_advisor:{id:string;full_name:string}|null};const[{data:rawActions},{data:rawConsultations},{data:rawNotes},{data:rawActivity}]=await Promise.all([supabase.from("travel_actions").select("*").eq("travel_file_id",id).order("created_at",{ascending:false}),supabase.from("travel_consultations").select(`*, conducted_by_profile:profiles!conducted_by (id, full_name), assigned_advisor:profiles!assigned_advisor_id (id, full_name)`).eq("travel_file_id",id).order("consulted_at",{ascending:false}),supabase.from("travel_notes").select(`*, author:profiles!created_by (id, full_name)`).eq("travel_file_id",id).order("created_at",{ascending:false}),supabase.from("travel_activity").select(`*, actor_user:profiles!actor_user_id (id, full_name)`).eq("travel_file_id",id).order("created_at",{ascending:false})]);const actions=(rawActions as TravelAction[]|null)??[],consultations=(rawConsultations as unknown as (TravelConsultation&{conducted_by_profile:{id:string;full_name:string}|null;assigned_advisor:{id:string;full_name:string}|null})[]|null)??[],activity=(rawActivity as unknown as (TravelActivity&{actor_user:{id:string;full_name:string}|null})[]|null)??[];const previousNotes=(rawNotes as unknown as Array<{id:string;note_type:string;note_text:string;created_at:string;author:{id:string;full_name:string}|null}>)??[];const profileIds=new Set<string>();actions.forEach(a=>{if(a.responsible_user_id)profileIds.add(a.responsible_user_id)});let profileMap:Record<string,string>={};if(profileIds.size){const{data:p}=await supabase.from("profiles").select("id, full_name").in("id",[...profileIds]);profileMap=Object.fromEntries((p??[]).map(x=>[x.id,x.full_name]))}const sortedActions=[...actions].sort((a,b)=>{const aa=a.status==="active"||a.status==="pending",bb=b.status==="active"||b.status==="pending";if(aa&&!bb)return-1;if(!aa&&bb)return 1;return new Date(b.created_at).getTime()-new Date(a.created_at).getTime()});const currentAction=file.current_action,isAdmin=user.role==="admin"||user.role==="super_admin";let contactEmail="",contactPhone="";if(file.briitely_contact_id){try{const c=await getContact(file.briitely_contact_id);contactEmail=c.email;contactPhone=c.phone}catch{}}const canSendRetainer=currentAction?.action_code==="send_tmf_agreement"&&currentAction.status==="active"&&(isAdmin||currentAction.responsible_user_id===user.id);const edit=(section:"trip"|"inquiry"|"booking"|"insurance"|"assignment",values:Record<string,string|number|boolean|null|undefined>)=>user.isActive?<TravelFileSectionEditor travelFileId={file.id} updatedAt={file.updated_at} section={section} values={values}/>:undefined;
const currentActionControl=<CurrentActionControl travelFileId={file.id} clientName={file.client_name} destination={file.destination} tripType={file.trip_type} travelTimeframe={file.travel_timeframe} departureDate={file.departure_date} returnDate={file.return_date} numberOfAdults={file.number_of_adults} numberOfChildren={file.number_of_children} childrenAges={file.children_ages} budgetRange={file.budget_range} insuranceInterest={file.insurance_interest} specialConsiderations={file.special_requests} staffNotes={file.staff_notes} assignedAdvisorId={file.assigned_advisor_id} canEdit={user.isActive} currentActionCode={currentAction?.action_code??null} currentActionStatus={currentAction?.status??null} previousNotes={previousNotes}/>;
return <div className="min-h-screen"><DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role}/><main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8"><Button variant="ghost" asChild className="-ml-3"><Link href="/dashboard"><ArrowLeft className="h-4 w-4"/>Back to Dashboard</Link></Button><div className="flex flex-col justify-between gap-4 px-1 pb-1 sm:flex-row sm:items-start"><div><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-primary">Travel File</div><h1 className="mt-1 text-3xl font-semibold tracking-tight">{file.briitely_contact_id?<Link href={`/customers/${encodeURIComponent(file.briitely_contact_id)}`} className="hover:text-primary hover:underline">{file.client_name}</Link>:file.client_name}</h1><p className="mt-1 text-sm text-muted-foreground">{file.destination||"Trip details pending"}{file.departure_date?` · ${formatDateOnly(file.departure_date)}`:""}</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant={formatStageBadgeVariant(file.stage)}>{formatStageLabel(file.stage)}</Badge><TravelFileActions travelFileId={file.id} clientName={file.client_name} destination={file.destination} tripType={file.trip_type} canDelete={isAdmin}/></div></div>
<CurrentActionSection file={file} currentAction={currentAction} profileMap={profileMap} isAdmin={isAdmin} canSendRetainer={canSendRetainer} contactEmail={contactEmail} contactPhone={contactPhone} currentActionControl={currentActionControl}/>
<TravelFileTasks travelFileId={file.id} canEdit={user.isActive}/>
<AssignmentSection file={file} edit={edit}/>
<TravelPartyCard travelFileId={file.id}/>
<TripDetailsSection file={file} edit={edit}/>
<BookingPlanningSection file={file} edit={edit}/>
<InsuranceSection file={file} edit={edit}/>
<TravelNotesSection travelFileId={file.id} legacyStaffNotes={file.staff_notes} isAdmin={isAdmin} currentUserId={user.id}/>
<PaymentsSection travelFileId={file.id}/>
<RetainerDetailsSection file={file}/>
<InquiryDetailsSection file={file} edit={edit}/>
<ConsultationHistorySection consultations={consultations}/>
<ActionHistorySection actions={sortedActions} profileMap={profileMap}/>
<ActivityHistorySection activity={activity}/>
</main><SharedFooter maxWidth="max-w-6xl" label="Travel File"/></div>
}