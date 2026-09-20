import { CurrentActionTasks } from "@/components/app/current-action-tasks";
import { SendTmfButton } from "@/components/app/send-tmf-button";
import { WorkflowOverrideButton } from "@/components/app/workflow-override-button";
import {
  TravelFileAside as Aside,
  TravelFileInfo as Info,
  TravelFilePanel as Panel,
  TravelFileSectionTitle as SectionTitle,
  getResponsibleName,
} from "@/components/app/travel-file-display";
import { Badge } from "@/components/core/ui/badge";
import { formatDueOrWaiting, isOverdue } from "@/lib/travel/format";
import type { TravelAction, TravelFile } from "@/lib/travel/types";

type FileWithAdvisor = TravelFile & {
  assigned_advisor: { id: string; full_name: string } | null;
};

interface CurrentActionSectionProps {
  file: FileWithAdvisor;
  currentAction: TravelAction | null;
  profileMap: Record<string, string>;
  isAdmin: boolean;
  canSendRetainer: boolean;
  contactEmail: string;
  contactPhone: string;
  currentActionControl: React.ReactNode;
}

export function CurrentActionSection({
  file,
  currentAction,
  profileMap,
  isAdmin,
  canSendRetainer,
  contactEmail,
  contactPhone,
  currentActionControl,
}: CurrentActionSectionProps) {
  return (
    <Panel>
      <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
        <Aside
          eyebrow="Workflow"
          title="Current action"
          text="The next step currently driving this travel file."
          action={isAdmin ? (
            <WorkflowOverrideButton
              travelFileId={file.id}
              currentStage={file.stage}
              currentActionCode={currentAction?.action_code ?? null}
              currentActionStatus={currentAction?.status ?? null}
              currentResponsibleType={currentAction?.responsible_type ?? null}
              currentResponsibleName={currentAction ? getResponsibleName(currentAction, profileMap) : null}
            />
          ) : undefined}
        />
        <div>
          {currentAction ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{currentAction.title.replaceAll("TMF", "Retainer")}</h2>
                <Badge variant="secondary" className="capitalize">{currentAction.action_role}</Badge>
                <Badge variant="outline" className="capitalize">{currentAction.status}</Badge>
              </div>
              {currentAction.description && (
                <p className="mt-1 text-sm text-muted-foreground">{currentAction.description.replaceAll("TMF", "Retainer")}</p>
              )}
              <div className="mt-4 grid gap-4 sm:grid-cols-3 sm:items-start">
                <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                  <Info label="Responsible" value={getResponsibleName(currentAction, profileMap)} />
                  <Info
                    label="Due / Waiting"
                    value={<span className={isOverdue(currentAction.due_at) ? "text-destructive" : ""}>{formatDueOrWaiting(currentAction.due_at, currentAction.waiting_since)}</span>}
                  />
                </div>
                <div className="min-h-9">
                  {canSendRetainer ? (
                    <SendTmfButton
                      travelFileId={file.id}
                      clientName={file.client_name}
                      email={contactEmail}
                      phone={contactPhone}
                      destination={file.destination}
                      assignedAdvisorName={file.assigned_advisor?.full_name ?? null}
                      tmfAmount={file.tmf_amount}
                      revisionsIncluded={file.revisions_included}
                      agreementDate={new Date().toLocaleDateString("en-CA")}
                    />
                  ) : currentActionControl}
                </div>
              </div>
              {currentAction.notes && (
                <div className="mt-5">
                  <SectionTitle>Operational note</SectionTitle>
                  <p className="text-sm">{currentAction.notes}</p>
                </div>
              )}
              {currentAction.status === "active" && (
                <CurrentActionTasks travelFileId={file.id} currentActionCode={currentAction.action_code} />
              )}
            </>
          ) : (
            <p className="text-sm italic text-muted-foreground">No current action</p>
          )}
        </div>
      </div>
    </Panel>
  );
}
