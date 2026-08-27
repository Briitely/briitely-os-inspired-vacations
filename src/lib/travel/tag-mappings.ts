/**
 * Centralized answer-to-tag mappings for Inspired Vacations intake.
 *
 * All Briitely tag strings used by the portal intake service are defined
 * here. UI components import the option labels from this module so that
 * literal tag strings never appear in form components.
 */

export interface TagOption {
  /** Human-readable label shown in the form */
  label: string;
  /** Briitely tag(s) to apply when this option is selected */
  tags: string[];
}

export const travelInterestOptions: TagOption[] = [
  { label: "Beach/All-Inclusive", tags: ["interest-beach", "interest-all-inclusive"] },
  { label: "Cruise/River Cruise", tags: ["interest-cruise"] },
  { label: "Custom (multi-destination)", tags: ["interest-custom"] },
  { label: "Africa", tags: ["interest-africa"] },
  { label: "Asia", tags: ["interest-asia"] },
  { label: "Australia", tags: ["interest-australia"] },
  { label: "Europe", tags: ["interest-europe"] },
  { label: "North America", tags: ["interest-north-america"] },
  { label: "South America", tags: ["interest-south-america"] },
  { label: "Active/Adventure", tags: ["interest-active-adventure"] },
  { label: "Arts/Cultural/History", tags: ["interest-arts-culture-history"] },
  { label: "Group Travel", tags: ["interest-groups"] },
  { label: "Family Vacation", tags: ["interest-family-vacation"] },
  { label: "Romantic Travel", tags: ["interest-romance"] },
  { label: "Sports", tags: ["interest-sports"] },
];

export const travelSeasonOptions: TagOption[] = [
  { label: "Winter", tags: ["travel-season-winter"] },
  { label: "Spring", tags: ["travel-season-spring"] },
  { label: "Summer", tags: ["travel-season-summer"] },
  { label: "Fall", tags: ["travel-season-fall"] },
  { label: "Flexible", tags: ["travel-season-flexible"] },
];

export const referralSourceOptions: TagOption[] = [
  { label: "BNI", tags: ["source-bni"] },
  { label: "Breakfast Club", tags: ["source-breakfast-club"] },
  { label: "Event", tags: ["source-event"] },
  { label: "Existing Client", tags: ["source-existing-client"] },
  { label: "Family", tags: ["source-family"] },
  { label: "Google Search", tags: ["source-google-search"] },
  { label: "Other", tags: ["source-other"] },
  { label: "Referral", tags: ["source-referral"] },
  { label: "Rotary", tags: ["source-rotary"] },
  { label: "Social Media", tags: ["source-social-media"] },
  { label: "Website", tags: ["source-website"] },
];

/** Trip type options for the intake form (operational, not a tag) */
export const tripTypeOptions: string[] = [
  "Beach/All-Inclusive",
  "Cruise",
  "River Cruise",
  "Custom (multi-destination)",
  "Escorted Group Tour",
  "Family Vacation",
  "Romantic Getaway",
  "Adventure/Active",
  "Arts/Cultural/History",
  "Sports Travel",
  "Other",
];

/** Budget range options for the intake form */
export const budgetRangeOptions: string[] = [
  "Under $2,500 per person",
  "$2,500 – $4,999 per person",
  "$5,000 – $7,499 per person",
  "$7,500 – $9,999 per person",
  "$10,000+ per person",
  "Not sure yet",
];

/** Intake method options for internal staff form */
export const intakeMethodOptions: string[] = [
  "website",
  "phone",
  "email",
  "referral",
  "walk_in",
  "staff",
];

/** The final trigger tag applied after all processing succeeds */
export const NEW_INQUIRY_TAG = "new-inquiry";

/**
 * Resolve selected labels to their corresponding Briitely tags.
 * Returns a flat, deduplicated array of tag strings.
 */
export function resolveTagsFromSelections(
  options: TagOption[],
  selectedLabels: string[]
): string[] {
  const tagSet = new Set<string>();
  for (const label of selectedLabels) {
    const option = options.find((o) => o.label === label);
    if (option) {
      for (const tag of option.tags) {
        tagSet.add(tag);
      }
    }
  }
  return [...tagSet];
}
