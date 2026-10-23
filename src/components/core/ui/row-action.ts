/**
 * Actions inside a list row (Edit Date, Remove, Edit Subscription) are small,
 * text-only buttons so every row lines up. Buttons outside lists keep their
 * icon: Plus for Add / Create / New, Pencil for Edit.
 */
export const rowAction = "rounded-md px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50";
export const rowActionDestructive = `${rowAction} text-destructive`;
