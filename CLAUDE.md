# Inspired Vacations — Briitely OS

Briitely OS dashboard for Inspired Vacations, built on Briitely OS Core. Core-wide changes come in from Core and are tracked in the Briitely Core Sync checklist; keep shared files (`src/styles/briitely-os.css`, `src/components/core/`, `src/lib/navigation*.ts`) the same as Core.

## UI standards (follow on every change)

- Add / Create / New buttons: Plus icon before the label, never a typed "+".
- Edit buttons: Pencil icon, and the label names what it edits ("Edit Trip Details", never "Edit").
- Actions inside list rows: text-only, using `rowAction` / `rowActionDestructive` from `src/components/core/ui/row-action.ts`.
- Pop-ups use `osConfirm` / `OsDialog`, never `window.confirm`, `alert` or `prompt`.
- Dates show as "Oct 13, 2026" (`formatDateOnly`); missing values show a dash (—); phone numbers show as (403) 555-0123.
- Every signed-in page uses `workspace-shell` and the standard page header (eyebrow, display heading, one-line description). The navigation menu comes from `src/config/navigation.ts`; top-level pages don't need a back button.
- Find the client first: New Inquiry (and any new client record) opens with `FindCustomerStep noun="client"`, then the form is a stack of `FormSectionCard`s starting with `SelectedCustomer noun="client"` (Change Client). Contact details are edited on the client file, not retyped. A client created in step 1 counts as new (`newClient`), so "How They Heard About Us" shows; it is optional.
- Say "client", never "customer", in anything staff see.
- Roles are Super Admin, Admin and Staff (`src/lib/auth/permissions.ts`). Check permissions on the server, not just by hiding buttons.
- Before committing UI changes, run `npm run check:ui` and fix anything it lists.
