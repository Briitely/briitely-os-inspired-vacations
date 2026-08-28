import "server-only";

import { briitelyRequest, getLocationId } from "./client";

// ── Types ─────────────────────────────────────────────────────

export interface SendTemplateInput {
  templateId: string;
  userId: string;
  contactId: string;
  opportunityId?: string | null;
  sendDocument?: boolean;
}

export interface SendTemplateResult {
  success: boolean;
  documentId?: string;
  links?: TemplateSendLink[];
  error?: string;
}

interface TemplateSendLink {
  referenceId?: string;
  documentId?: string;
  recipientId?: string;
  entityName?: string;
  recipientCategory?: string;
  documentRevision?: number;
  createdBy?: string;
  deleted?: boolean;
}

interface HighLevelSendTemplateResponse {
  success?: boolean;
  links?: TemplateSendLink[];
}

// ── Template ID resolution ────────────────────────────────────

export type TmfTemplateType = "ivt" | "all_inclusive";

export function getTmfTemplateId(type: TmfTemplateType): string | null {
  const envVar =
    type === "all_inclusive"
      ? "TMF_TEMPLATE_ID_ALL_INCLUSIVE"
      : "TMF_TEMPLATE_ID_IVT";
  return process.env[envVar] ?? null;
}

export function isTmfTemplateConfigured(type: TmfTemplateType): boolean {
  return getTmfTemplateId(type) !== null;
}

// ── Send Template ─────────────────────────────────────────────

export async function sendDocumentTemplate(
  input: SendTemplateInput
): Promise<SendTemplateResult> {
  const locationId = getLocationId();

  const body: Record<string, unknown> = {
    templateId: input.templateId,
    userId: input.userId,
    sendDocument: input.sendDocument ?? true,
    locationId,
    contactId: input.contactId,
  };

  if (input.opportunityId) {
    body.opportunityId = input.opportunityId;
  }

  try {
    const response = await briitelyRequest<HighLevelSendTemplateResponse>({
      method: "POST",
      path: "/proposals/templates/send",
      body,
    });

    const documentId = response.links?.[0]?.documentId ?? undefined;

    return {
      success: response.success ?? true,
      documentId,
      links: response.links,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to send document template.";
    return { success: false, error: message };
  }
}
