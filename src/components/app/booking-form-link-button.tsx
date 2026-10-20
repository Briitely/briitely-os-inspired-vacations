"use client";
import{useEffect,useState}from"react";
import Link from"next/link";
import{Eye,RefreshCw}from"lucide-react";
import{Button}from"@/components/core/ui/button";
import{TravelPartyResendBookingFormsModal}from"@/components/app/travel-party-resend-booking-forms-modal";

async function readResponse(r:Response){const t=await r.text();if(!t)return{} as any;try{return JSON.parse(t)}catch{return{error:r.ok?"The server returned an invalid response.":`Booking form request failed (${r.status}).`}}}

export function BookingFormLinkButton({travelFileId}:{travelFileId:string}){
  const[completed,setCompleted]=useState<{submitted_at:string;change_count:number}|null>(null);
  const[canResend,setCanResend]=useState(false);
  const[showResend,setShowResend]=useState(false);const[unreviewedChangeCount,setUnreviewedChangeCount]=useState(0);

  useEffect(()=>{(async()=>{try{const[p,s]=await Promise.all([
    fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/travellers`).then(readResponse),
    fetch(`/api/travel-files/${encodeURIComponent(travelFileId)}/booking-form-status`).then(readResponse)
  ]);setCompleted(p.completedBookingForm??null);setCanResend(Boolean(s.primaryPrepared||s.primaryBookingPrepared||(s.preparedRecipientIds??[]).length));setUnreviewedChangeCount(Number(s.unreviewedChangeCount??0))}catch{}})()},[travelFileId]);

  return <div className="flex w-full flex-col gap-1"><div className="flex w-full flex-col gap-2">{completed&&<Button variant="outline" size="sm" asChild className="w-full justify-start"><Link href={`/travel-files/${encodeURIComponent(travelFileId)}/booking-form`}><Eye className="h-4 w-4"/><span className="flex-1 text-left">View Forms</span>{unreviewedChangeCount>0&&<span className="rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">Review</span>}</Link></Button>}{canResend&&<Button variant="outline" size="sm" className="w-full justify-start" onClick={()=>setShowResend(true)}><RefreshCw className="h-4 w-4"/><span className="flex-1 text-left">Resend Booking Forms</span></Button>}</div>{showResend&&<TravelPartyResendBookingFormsModal travelFileId={travelFileId} isOpen={showResend} onClose={()=>setShowResend(false)}/>}</div>
}
