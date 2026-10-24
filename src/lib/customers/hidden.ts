/** Hidden clients carry this tag in Briitely; client searches leave them out unless an Admin asks to see them. */
export const HIDDEN_TAG = "Hidden";

export const isHidden = (tags?: string[] | null) => (tags ?? []).some((tag) => tag.trim().toLowerCase() === HIDDEN_TAG.toLowerCase());
