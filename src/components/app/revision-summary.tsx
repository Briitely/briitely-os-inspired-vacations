"use client";
import{useEffect,useState}from"react";
type Props={travelFileId:string};
export function RevisionSummary({travelFileId}:Props){const[data,setData]=useState<{revisionsUsed:number;revisionsIncluded:number}|null>(null);useEffect(()=>{fetch(`/api/travel-files/${travelFileId}/negotiation`).then(r=>r.ok?r.json():null).then(d=>d&&setData({revisionsUsed:d.revisionsUsed??0,revisionsIncluded:d.revisionsIncluded??0})).catch(()=>{})},[travelFileId]);if(!data)return null;return <div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Revisions used</div><div className="mt-1 break-words text-sm font-medium">{data.revisionsUsed} of {data.revisionsIncluded||"—"}</div></div>}
