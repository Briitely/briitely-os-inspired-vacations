"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Button} from "@/components/core/ui/button";
type File={id:string;destination:string|null;departure_date:string|null;stage:string};
export function DeceasedTravelFileReview({customerId}:{customerId:string}){
 const[files,setFiles]=useState<File[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState<string|null>(null),[confirm,setConfirm]=useState<string|null>(null);
 async function reload(){try{const r=await fetch(`/api/customers/${encodeURIComponent(customerId)}/open-primary-files`),d=await r.json();if(!r.ok)throw new Error(d.error??"Could not load open Travel Files");setFiles(d.files??[]);setError("")}catch(e){setError(e instanceof Error?e.message:"Could not load files")}finally{setLoading(false)}}
 useEffect(()=>{void reload()},[customerId]);
 async function markLost(id:string){setBusy(id);setError("");try{const r=await fetch(`/api/travel-files/${id}/mark-lost`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason:"Life Circumstances"})}),d=await r.json();if(!r.ok)throw new Error(d.error??"Could not mark lost");setConfirm(null);await reload()}catch(e){setError(e instanceof Error?e.message:"Could not mark lost")}finally{setBusy(null)}}
 if(loading)return <p className="text-sm text-muted-foreground">Checking open Travel Files...</p>;
 if(!files.length&&!error)return null;
 return <section className="rounded-xl border p-5 space-y-3"><h2 className="font-semibold">Open Travel Files Require Review</h2><p className="text-sm text-muted-foreground">This client is marked deceased and remains the primary contact on these open trips. Reassign another traveller or close the trip as Lost / Not Qualified with reason Life Circumstances. No traveller or historical booking is deleted.</p>{files.map(f=><div key={f.id} className="rounded-md border p-3 space-y-2"><p className="font-medium">{f.destination||"Destination not specified"} {f.departure_date?"— "+f.departure_date:""}</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><Link href={`/travel-files/${f.id}`}>Open File to Reassign</Link></Button>{confirm===f.id?<><span className="text-sm">Mark this file lost — Life Circumstances?</span><Button size="sm" variant="destructive" disabled={busy===f.id} onClick={()=>markLost(f.id)}>Confirm Lost</Button><Button size="sm" variant="outline" onClick={()=>setConfirm(null)}>Cancel</Button></>:<Button size="sm" variant="outline" onClick={()=>setConfirm(f.id)}>Mark Lost — Life Circumstances</Button>}</div></div>)}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</section>
}
