"use client";

import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import {Mail,Loader2} from "lucide-react";
import {Button} from "@/components/core/ui/button";
import {RevisionSummary} from "@/components/app/revision-summary";

function firstNameOnly(value:string){return value.trim().split(/\s+/)[0]||"Your Inspired Vacations Advisor"}
function gmail(to:string,firstName:string,url:string,advisor:string){const subject="🌴 Your Custom Trip Proposal is Ready! ✈️";const body=[`Hi ${firstName},`,"","Exciting news — your personalized travel proposal is ready! 🎉 We've crafted it just for you, packed with options and ideas to make your trip unforgettable.","","You should see it in your inbox now. If it doesn't appear, please check your spam or junk folder — or you can click the link here: "+url,"","Take your time to explore it, and if you have any questions, want to tweak something, or just want to chat about your options, we're here and happy to help. Just hit reply on this email and we'll get back to you! 🌺","","We can't wait to hear what you think!","","Cheers,","",`${firstNameOnly(advisor)} & the Inspired Vacations Team ✈️`];return`https://mail.google.com/mail/?${new URLSearchParams({view:"cm",fs:"1",to,su:subject,body:body.join("\n")})}`}

export function ResendProposalEmailButton({travelFileId}:{travelFileId:string}){
 const[loading,setLoading]=useState(false),[available,setAvailable]=useState(false),[data,setData]=useState<any>(null),[error,setError]=useState<string|null>(null),[revisionMount,setRevisionMount]=useState<HTMLElement|null>(null);
 useEffect(()=>{let active=true;fetch(`/api/travel-files/${travelFileId}/proposal-send`).then(r=>r.json()).then(d=>{if(!active)return;setData(d);setAvailable(Boolean(d.travefyProposalUrl&&d.email))}).catch(()=>{});return()=>{active=false}},[travelFileId]);
 useEffect(()=>{let mount:HTMLElement|null=null;const panels=[...document.querySelectorAll("main > div")];const booking=panels.find(el=>el.textContent?.includes("Booking & planning")&&el.textContent?.includes("Booking information")) as HTMLElement|undefined;if(booking){const labels=[...booking.querySelectorAll("div")];const bookingNumberLabel=labels.find(el=>el.textContent?.trim()==="BOOKING NUMBER") as HTMLElement|undefined;const infoBlock=bookingNumberLabel?.parentElement as HTMLElement|null;if(infoBlock?.parentElement){mount=document.createElement("div");infoBlock.parentElement.insertBefore(mount,infoBlock.nextSibling);setRevisionMount(mount)}}return()=>mount?.remove()},[travelFileId]);
 async function resend(){setLoading(true);setError(null);try{let d=data;if(!d){const r=await fetch(`/api/travel-files/${travelFileId}/proposal-send`);d=await r.json()}if(!d?.travefyProposalUrl)throw new Error("No Travefy Proposal URL is saved on this Travel File.");if(!d?.email)throw new Error("The primary client email is missing.");window.open(gmail(d.email,d.firstName??"there",d.travefyProposalUrl,d.assignedAdvisorName??"Your Inspired Vacations Advisor"),"_blank","noopener,noreferrer")}catch(e){setError(e instanceof Error?e.message:"Could not prepare the proposal email.")}finally{setLoading(false)}}
 return <>{available&&<div className="space-y-1"><Button variant="outline" size="sm" className="w-full justify-start" onClick={resend} disabled={loading}>{loading?<Loader2 className="h-4 w-4 animate-spin"/>:<Mail className="h-4 w-4"/>}Resend Proposal Email</Button>{error&&<p className="text-xs text-destructive">{error}</p>}</div>}{revisionMount&&createPortal(<RevisionSummary travelFileId={travelFileId}/>,revisionMount)}</>
}
