"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Archive,Loader2,RefreshCcw,X} from "lucide-react";
import {Button} from "@/components/core/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/core/ui/card";

type Choice="reactivate"|"archive";
export function InactiveProposalReviewButtons({travelFileId}:{travelFileId:string}){
 const router=useRouter();
 const [choice,setChoice]=useState<Choice|null>(null);
 const [loading,setLoading]=useState<Choice|null>(null);
 const [error,setError]=useState<string|null>(null);
 async function confirm(){
  if(!choice||loading)return;
  const kind=choice;
  setLoading(kind);setError(null);
  try{
   const endpoint=kind==="reactivate"?"reactivate-proposal":"archive-inactive-proposal";
   const r=await fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/${endpoint}`,{method:"POST"});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(d.error??`Could not ${kind} the proposal.`);
   setChoice(null);window.location.reload();
  }catch(e){setError(e instanceof Error?e.message:`Could not ${kind} the proposal.`)}
  finally{setLoading(null)}
 }
 return <div className="flex flex-col items-end gap-2">
  <div className="flex flex-wrap justify-end gap-2">
   <Button size="sm" variant="outline" onClick={()=>{setError(null);setChoice("reactivate")}} disabled={Boolean(loading)}><RefreshCcw className="h-4 w-4"/>Reactivate Proposal</Button>
   <Button size="sm" variant="destructive" onClick={()=>{setError(null);setChoice("archive")}} disabled={Boolean(loading)}><Archive className="h-4 w-4"/>Archive Opportunity</Button>
  </div>
  {error&&!choice&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {choice&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
   <Card role="dialog" aria-modal="true" aria-label={choice==="archive"?"Archive Opportunity":"Reactivate Proposal"} className="w-full max-w-lg shadow-xl">
    <CardHeader className="flex-row items-center justify-between border-b">
     <CardTitle>{choice==="archive"?"Archive Opportunity":"Reactivate Proposal"}</CardTitle>
     <button type="button" aria-label="Close" disabled={Boolean(loading)} onClick={()=>setChoice(null)}><X className="h-5 w-5"/></button>
    </CardHeader>
    <CardContent className="space-y-5 p-6">
     {choice==="archive"?<p className="text-sm text-muted-foreground">The client has not responded to the proposal follow-ups. Archiving will move this Travel File to <strong>Lost / Not Qualified</strong>.</p>:<p className="text-sm text-muted-foreground">Reactivate this proposal and move the Travel File to <strong>Negotiating</strong> so the team can continue with revisions or acceptance.</p>}
     {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
     <div className="flex justify-end gap-2 border-t pt-4">
      <Button variant="outline" disabled={Boolean(loading)} onClick={()=>{setChoice(null);setError(null)}}>Cancel</Button>
      <Button variant={choice==="archive"?"destructive":"default"} disabled={Boolean(loading)} onClick={()=>void confirm()}>
       {loading?<Loader2 className="h-4 w-4 animate-spin"/>:choice==="archive"?<Archive className="h-4 w-4"/>:<RefreshCcw className="h-4 w-4"/>}
       {choice==="archive"?"Archive Opportunity":"Reactivate Proposal"}
      </Button>
     </div>
    </CardContent>
   </Card>
  </div>}
 </div>
}
