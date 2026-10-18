# Inspired Vacations — Proposal workflow and staff assignments

## Important architectural decision (October 18, 2026)

**Do not create PostgreSQL triggers or migrations for individual staff assignments.** The dashboard already uses `profiles.id` and `travel_actions.responsible_user_id` to assign work. Use the existing application workflow and active profiles to assign advisors, Dana, or any other team member. A prior proposal-specific trigger searched names and blocked workflow progression; it was removed by migration `20261018193000_remove_proposal_assignment_trigger.sql`.

- On finalizing negotiation, create `proposal_acceptance_deposit_agreement` for the assigned advisor, due next Alberta business day.
- On sending the agreement, change to `await_proposal_acceptance`, responsible client, waiting since send.
- Only after the **current proposal cycle's** signed agreement and travel preferences submission are both complete, create the pending deposit (idempotently) and advance to `collect_deposit`, responsible Dana's existing active profile, due next business day.
- Never charge a card, mark a deposit paid, or infer a form submission from merely opening/closing the form.
- The agreement payment reference `external_reference` is internal deduplication metadata, **not** a supplier confirmation number. Display `Proposal Deposit — Card Authorized` and `Per signed agreement`; show the authorized card's last four digits.
- Agreement acceptance and submission remain in activity/action history. No separate signed-agreement viewer is required now.
- Preserve signed agreements and existing deposit payment records on retries; do not duplicate deposits.
- When team members change, use existing assignment controls/profile IDs, not a migration.
- Business-day due dates skip weekends (statutory holidays are not currently accounted for).

Current Dana Pasquotti profile ID from the project's existing `profiles` table: `57c99ca4-6128-4920-9d69-744f85cc514b`. Prefer a centralized configuration/role mapping over scattering IDs in new workflow implementations.
