import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { DashboardHeaderWrapper } from "@/components/app/dashboard-header-wrapper";
import { UsersTable } from "@/components/app/users-table";
import { createServiceClient } from "@/lib/supabase/service";
import { Card, CardContent } from "@/components/core/ui/card";
import { Building2, ArrowLeft, Lock } from "lucide-react";
import type { UserStatus } from "@/lib/admin/types";
import { getBriitelyUsers, type BriitelyUserOption } from "@/lib/briitely/users";
import { linkProfilesByEmail } from "@/lib/staff/briitely-user-links";

interface ProfileRow { id:string; email:string|null; full_name:string|null; first_name:string|null; last_name:string|null; role:"super_admin"|"admin"|"staff"; is_active:boolean; ghl_user_id:string|null; created_at:string; updated_at:string; }

export default async function AdminUsersPage(){
 const {user,error}=await getAuthenticatedUser(); if(error||!user) redirect("/login");
 if(user.role!=="admin"&&user.role!=="super_admin") return <div className="min-h-screen bg-background"><DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role}/><main className="workspace-shell"><Card><CardContent className="py-12 text-center"><Lock className="h-10 w-10 mx-auto"/><p>You do not have permission to access this area.</p></CardContent></Card></main></div>;
 const isSuperAdmin=user.role==="super_admin"; const {createClient}=await import("@/lib/supabase/server"); const supabase=await createClient(); const serviceClient=createServiceClient();
 const {data,error:profilesError}=await supabase.from("profiles").select("id,email,full_name,first_name,last_name,role,is_active,ghl_user_id,created_at,updated_at").order("created_at",{ascending:true});
 if(profilesError) console.error("ADMIN_USERS_PROFILE_LIST_FAILED",profilesError);
 let profiles=(data??[]) as ProfileRow[];
 if(!profiles.some(p=>p.id===user.id)) profiles=[{id:user.id,email:user.email,full_name:user.fullName,first_name:user.firstName,last_name:user.lastName,role:user.role,is_active:true,ghl_user_id:user.ghlUserId,created_at:"",updated_at:""},...profiles];
 const activated=new Set<string>(); const lastSignIn=new Map<string,string>(); if(serviceClient&&profiles.length){const {data:authData,error:authError}=await serviceClient.auth.admin.listUsers({page:1,perPage:1000}); if(authError) console.error("ADMIN_USERS_AUTH_LIST_FAILED",authError); for(const au of authData?.users??[]) if(au.last_sign_in_at){activated.add(au.id);lastSignIn.set(au.id,au.last_sign_in_at);}}
 // Link active team members to their Briitely user by email, so new hires only need a Briitely user with the same email.
 let briitelyUsers:BriitelyUserOption[]=[]; let links=new Map<string,string|null>(profiles.map(p=>[p.id,p.ghl_user_id?.trim()||null])); let directoryAvailable=true;
 try{ links=await linkProfilesByEmail(profiles.filter(p=>p.is_active)); for(const p of profiles) if(!links.has(p.id)) links.set(p.id,p.ghl_user_id?.trim()||null); briitelyUsers=await getBriitelyUsers(); }catch(err){ directoryAvailable=false; console.warn("ADMIN_USERS_BRIITELY_DIRECTORY_FAILED",err instanceof Error?err.message:"unknown"); }
 const ghlLabelFor=(id:string|null)=>!id?"Not linked":briitelyUsers.find(u=>u.id===id)?.label??(directoryAvailable?"Linked user not found in Briitely":"Linked");
 const displayProfiles=profiles.map(p=>{const protectedSA=p.role==="super_admin"&&!isSuperAdmin; const status:UserStatus=!p.is_active?"inactive":activated.has(p.id)?"active":"pending"; return {id:p.id,email:p.email??"",firstName:p.first_name??"",lastName:p.last_name??"",fullName:p.full_name??([p.first_name,p.last_name].filter(Boolean).join(" ")||(p.email??"")),role:p.role,isActive:p.is_active,status,ghlUserId:links.get(p.id)??"",ghlLabel:ghlLabelFor(links.get(p.id)??null),lastSignInAt:lastSignIn.get(p.id)??null,isSelf:p.id===user.id,canEdit:!protectedSA,canToggleActive:!protectedSA&&p.id!==user.id,canChangeRole:!protectedSA,canResendInvite:!protectedSA&&status==="pending"};});
 return <div className="min-h-screen bg-background"><DashboardHeaderWrapper fullName={user.fullName} email={user.email} role={user.role}/><main className="workspace-shell space-y-6"><div><Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/>Back to Admin</Link></div><div><p className="eyebrow">Admin</p><h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Users & Access</h1><p className="mt-1 text-muted-foreground">Manage your team members and their access to Briitely OS.</p></div><UsersTable profiles={displayProfiles} isSuperAdmin={isSuperAdmin}/></main><footer className="border-t border-border mt-16"><div className="workspace-footer"><Building2 className="h-4 w-4"/><span>Briitely OS — Business Dashboard</span></div></footer></div>;
}
