-- One-time cleanup: remove the redundant proposal assignment trigger.
-- Assignments and due dates belong to application workflows, as with all other actions.
drop trigger if exists iv_proposal_action_deadlines_insert on public.travel_actions;
drop function if exists public.iv_proposal_action_deadlines();
-- Keep iv_next_business_day for compatibility with any existing database callers.
