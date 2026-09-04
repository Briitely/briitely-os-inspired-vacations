import "server-only";
import { briitelyRequest } from "./client";

interface SendEmailInput {
  contactId: string;
  subject: string;
  html: string;
  emailFrom?: string;
}

export async function sendContactEmail(input: SendEmailInput) {
  return briitelyRequest<{ messageId?: string; conversationId?: string }>({
    method: "POST",
    path: "/conversations/messages",
    version: "2021-04-15",
    body: {
      type: "Email",
      contactId: input.contactId,
      subject: input.subject,
      html: input.html,
      ...(input.emailFrom ? { emailFrom: input.emailFrom } : {}),
    },
  });
}
