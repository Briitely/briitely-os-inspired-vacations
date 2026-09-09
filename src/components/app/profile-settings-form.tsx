"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/core/ui/card";
import { Input } from "@/components/core/ui/input";
import { Label } from "@/components/core/ui/label";
import { Loader2 } from "lucide-react";

export function ProfileSettingsForm({ firstName, lastName, loginEmail, senderEmail }: { firstName:string; lastName:string; loginEmail:string; senderEmail:string }) {
  const router=useRouter();
  const [first,setFirst]=useState(firstName),[last,setLast]=useState(lastName),[email,setEmail]=useState(loginEmail),[sender,setSender]=useState(senderEmail);
  const [password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[saving,setSaving]=useState(false),[message,setMessage]=useState<string|null>(null),[error,setError]=useState<string|null>(null);

  async function saveProfile(e:React.FormEvent){e.preventDefault();setSaving(true);setError(null);setMessage(null);try{const r=await fetch("/api/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({firstName:first,lastName:last,loginEmail:email,senderEmail:sender})});const d=await r.json();if(!r.ok)throw new Error(d.error??"Could not update profile.");setMessage(d.emailConfirmationRequired?"Profile saved. Check the new login email address to confirm the email change.":"Profile saved.");router.refresh()}catch(e){setError(e instanceof Error?e.message:"Could not update profile.")}finally{setSaving(false)}}
  async function changePassword(e:React.FormEvent){e.preventDefault();setError(null);setMessage(null);if(password.length<8){setError("Password must be at least 8 characters.");return}if(password!==confirm){setError("Passwords do not match.");return}setSaving(true);try{const supabase=createClient();const {error}=await supabase.auth.updateUser({password});if(error)throw error;setPassword("");setConfirm("");setMessage("Password updated.")}catch(e){setError(e instanceof Error?e.message:"Could not update password.")}finally{setSaving(false)}}

  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>Personal Details</CardTitle></CardHeader><CardContent><form onSubmit={saveProfile} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>First Name</Label><Input value={first} onChange={e=>setFirst(e.target.value)} required/></div><div className="space-y-2"><Label>Last Name</Label><Input value={last} onChange={e=>setLast(e.target.value)} required/></div></div><div className="space-y-2"><Label>Login Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/><p className="text-xs text-muted-foreground">Changing this changes the email you use to sign in. Supabase may ask you to confirm the new address.</p></div><div className="space-y-2"><Label>Email Used for Client Communications</Label><Input type="email" value={sender} onChange={e=>setSender(e.target.value)} required/><p className="text-xs text-muted-foreground">Until Briitely email is connected, prepared retainer, booking-form and proposal messages will open in this Gmail account. This can be different from your login email.</p></div><Button type="submit" disabled={saving}>{saving&&<Loader2 className="h-4 w-4 animate-spin"/>}Save Profile</Button></form></CardContent></Card>
    <Card><CardHeader><CardTitle>Change Password</CardTitle></CardHeader><CardContent><form onSubmit={changePassword} className="space-y-4"><div className="space-y-2"><Label>New Password</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8}/></div><div className="space-y-2"><Label>Confirm New Password</Label><Input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required minLength={8}/></div><Button type="submit" variant="outline" disabled={saving}>Change Password</Button></form></CardContent></Card>
    {message&&<p className="rounded-md border bg-muted/30 p-3 text-sm">{message}</p>}{error&&<p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
  </div>;
}
