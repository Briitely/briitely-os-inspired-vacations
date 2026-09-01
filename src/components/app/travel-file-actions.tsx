"use client";

import {useState} from "react";
import {Trash2} from "lucide-react";
import {Button} from "@/components/core/ui/button";
import {DeleteTravelFileDialog} from "@/components/app/delete-travel-file-dialog";

interface TravelFileActionsProps {
 travelFileId:string;clientName:string;destination:string|null;tripType:string|null;travelTimeframe:string|null;departureDate:string|null;returnDate:string|null;numberOfAdults:number|null;numberOfChildren:number|null;childrenAges:string|null;budgetRange:string|null;insuranceInterest:string|null;specialConsiderations:string|null;staffNotes:string|null;assignedAdvisorId:string|null;canEdit:boolean;canDelete:boolean;stage:string;currentActionCode:string|null;currentActionStatus:string|null;previousNotes:Array<{id:string;note_type:string;note_text:string;created_at:string;author:{id:string;full_name:string}|null}>;
}
export function TravelFileActions(props:TravelFileActionsProps){const[deleteOpen,setDeleteOpen]=useState(false);return <>{props.canDelete&&<Button variant="destructive" size="sm" onClick={()=>setDeleteOpen(true)}><Trash2 className="h-4 w-4"/>Delete Travel File</Button>}{props.canDelete&&<DeleteTravelFileDialog travelFileId={props.travelFileId} clientName={props.clientName} destination={props.destination} tripType={props.tripType} isOpen={deleteOpen} onClose={()=>setDeleteOpen(false)}/>}</>}
