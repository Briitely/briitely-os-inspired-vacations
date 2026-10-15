"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {Button} from "@/components/core/ui/button";
type Member={id:string;full_name:string};
export function CurrentActionAssignee({travelFileId,assignedId,assignedName}:{travelFileId:string;assignedId:string|null;assignedName:string}){
 const router=useRouter();const[editing,setEditing]=useState(false),[members,setMembers]=useState<Member[]>([]),[selected,setSelected]=useState(assignedId??""),[saving,setSaving]=useState(false),[error,setError]=useState("");
 useEffect(()=>{setSelected(assignedId??"")},[assignedId]);
 async function edit(){setEditing(true);setError("");try{const r=await fetch("/api/profiles");const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load team.");setMembers((d.profiles??d.users??[]).filter((p:Member&{is_active?:boolean})=>p.is_active!==false))}catch(e){setError(e instanceof Error?e.message:"Could not load team.")}}
 async function save(){setSaving(true);setError("");try{const r=await fetch(`/api/travel-files/${travelFileId}/current-action`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({responsibleUserId:selected})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not save assignment.");setEditing(false);router.refresh()}catch(e){setError(e instanceof Error?e.message:"Could not save assignment.")}finally{setSaving(false)}}
 return <div><div className="text-xs font-medium text-muted-foreground">Responsible</div>{!editing?<div className="flex items-center gap-2"><span className="text-sm">{assignedName}</span><Button type="button" variant="ghost" size="sm" onClick={edit}>Edit</Button></div>:<div className="flex flex-wrap items-center gap-2"><select className="h-9 rounded-md border bg-background px-2 text-sm" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select team member</option>{members.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select><Button type="button" size="sm" disabled={!selected||saving} onClick={save}>Save</Button><Button type="button" size="sm" variant="outline" onClick={()=>setEditing(false)}>Cancel</Button></div>}{error&&<p className="text-xs text-destructive">{error}</p>}</div>
}
