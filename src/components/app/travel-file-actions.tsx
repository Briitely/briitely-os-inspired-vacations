"use client";

import { useState } from "react";
import { Trash2, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/core/ui/button";
import { DeleteTravelFileDialog } from "@/components/app/delete-travel-file-dialog";
import { CompleteConsultationModal } from "@/components/app/complete-consultation-modal";

interface TravelFileActionsProps {
  travelFileId: string;
  clientName: string;
  destination: string | null;
  tripType: string | null;
  travelTimeframe: string | null;
  departureDate: string | null;
  returnDate: string | null;
  numberOfAdults: number | null;
  numberOfChildren: number | null;
  childrenAges: string | null;
  budgetRange: string | null;
  insuranceInterest: string | null;
  specialConsiderations: string | null;
  staffNotes: string | null;
  assignedAdvisorId: string | null;
  canEdit: boolean;
  canDelete: boolean;
  stage: string;
  currentActionCode: string | null;
  currentActionStatus: string | null;
  previousNotes: Array<{ id:string; note_type:string; note_text:string; created_at:string; author:{id:string;full_name:string}|null }>;
}

export function TravelFileActions(props: TravelFileActionsProps) {
  const [deleteOpen,setDeleteOpen]=useState(false);
  const [consultOpen,setConsultOpen]=useState(false);
  const showConsultButton=props.stage==="consult_booked"&&props.currentActionStatus!=="completed"&&(props.currentActionCode==="complete_initial_consultation"||props.currentActionCode==null);
  return <>
    <div className="flex items-center gap-2">
      {showConsultButton&&props.canEdit&&<Button size="sm" onClick={()=>setConsultOpen(true)}><ClipboardCheck className="h-4 w-4"/>Complete Initial Consultation</Button>}
      {props.canDelete&&<Button variant="destructive" size="sm" onClick={()=>setDeleteOpen(true)}><Trash2 className="h-4 w-4"/>Delete Travel File</Button>}
    </div>
    {showConsultButton&&props.canEdit&&consultOpen&&<CompleteConsultationModal key={`consult-${props.travelFileId}-${consultOpen}`} travelFileId={props.travelFileId} clientName={props.clientName} destination={props.destination} tripType={props.tripType} travelTimeframe={props.travelTimeframe} departureDate={props.departureDate} returnDate={props.returnDate} numberOfAdults={props.numberOfAdults} numberOfChildren={props.numberOfChildren} childrenAges={props.childrenAges} budgetRange={props.budgetRange} specialConsiderations={props.specialConsiderations} insuranceInterest={props.insuranceInterest} assignedAdvisorId={props.assignedAdvisorId} staffNotes={props.staffNotes} previousNotes={props.previousNotes} isOpen={consultOpen} onClose={()=>setConsultOpen(false)}/>} 
    {props.canDelete&&<DeleteTravelFileDialog travelFileId={props.travelFileId} clientName={props.clientName} destination={props.destination} tripType={props.tripType} isOpen={deleteOpen} onClose={()=>setDeleteOpen(false)}/>} 
  </>;
}
