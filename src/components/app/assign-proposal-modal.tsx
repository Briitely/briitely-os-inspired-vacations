"use client";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {CalendarDays,Loader2,UserRoundCheck,X} from "lucide-react";
import {Button} from "@/components/core/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/core/ui/card";
import {Input} from "@/components/core/ui/input";
import {Label} from "@/components/core/ui/label";

interface Advisor{id:string;full_name:string}
interface Props{travelFileId:string;assignedAdvisorId:string|null;currentProposalDueDate:string|null;isOpen:boolean;onClose:()=>void}

export function AssignProposalModal({travelFileId,assignedAdvisorId,currentProposalDueDate,isOpen,onClose}:Props){
 const router=useRouter();const[advisors,setAdvisors]=useState<Advisor[]>([]),[advisorId,setAdvisorId]=useState(assignedAdvisorId??""),[dueDate,setDueDate]=useState(currentProposalDueDate??""),[saving,setSaving]=useState(false),[error,setError]=useState<string|null>(null);
 useEffect(()=>{if(!isOpen)return;setAdvisorId(assignedAdvisorId??"");setDueDate(currentProposalDueDate??"");fetch("/api/travel-files/advisors").then(r=>r.json()).then(d=>setAdvisors(d.advisors??[])).catch(()=>{})},[isOpen,assignedAdvisorId,currentProposalDueDate]);
 async function submit(e:React.FormEvent){e.preventDefault();if(!advisorId)return setError("Select the advisor responsible for the proposal.");if(!dueDate)return setError("Set the proposal review due date.");setSaving(true);setError(null);try{const r=await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/assign-proposal`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({advisorId,dueDate})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error??"Could not assign the proposal.");onClose();router.refresh()}catch(e){setError(e instanceof Error?e.message:"Could not assign the proposal.")}finally{setSaving(false)}}
 if(!isOpen)return null;
 return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><Card className="w-full max-w-lg shadow-xl"><CardHeader className="flex-row items-center justify-between border-b"><CardTitle>Assign Proposal</CardTitle><button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5"/></button></CardHeader><form onSubmit={submit}><CardContent className="space-y-5 p-6"><div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">Assign the proposal to the advisor who will create it, and set the date it needs to be ready for review.</div><div className="space-y-2"><Label>Proposal Advisor *</Label><div className="relative"><UserRoundCheck className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><select value={advisorId} onChange={e=>setAdvisorId(e.target.value)} className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm"><option value="">Select an advisor...</option>{advisors.map(a=><option key={a.id} value={a.id}>{a.full_name}</option>)}</select></div></div><div className="space-y-2"><Label>Proposal Review Due Date *</Label><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="pl-9"/></div><p className="text-xs text-muted-foreground">This date will also populate Booking & Planning → Proposal Due.</p></div>{error&&<p className="text-sm text-destructive">{error}</p>}</CardContent><div className="flex justify-end gap-3 border-t p-4"><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving&&<Loader2 className="h-4 w-4 animate-spin"/>}Assign Proposal</Button></div></form></Card></div>
}
