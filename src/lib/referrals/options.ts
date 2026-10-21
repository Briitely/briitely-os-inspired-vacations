import { referralSourceOptions } from "@/lib/travel/tag-mappings";

/** The "How did you hear about us?" choices, in the same order as the intake forms. */
export const REFERRAL_SOURCES: string[] = referralSourceOptions.map((option) => option.label);

/** Sources that ask for the referrer's name. */
export const NAME_SOURCES = ["Referral", "BNI", "Breakfast Club", "Existing Client", "Rotary", "Family"];

/** Sources that ask which event. */
export const EVENT_SOURCES = ["Event"];

export interface ClientReferral {
  leadSource: string;
  referralName: string;
  eventName: string;
}

export function asksForName(source: string): boolean {
  return NAME_SOURCES.includes(source);
}

export function asksForEvent(source: string): boolean {
  return EVENT_SOURCES.includes(source);
}

/** Drops a name or event that doesn't belong with the chosen source. */
export function normalizeReferral(input: Partial<ClientReferral>): ClientReferral {
  const leadSource = (input.leadSource ?? "").trim();
  return {
    leadSource,
    referralName: asksForName(leadSource) ? (input.referralName ?? "").trim() : "",
    eventName: asksForEvent(leadSource) ? (input.eventName ?? "").trim() : "",
  };
}
