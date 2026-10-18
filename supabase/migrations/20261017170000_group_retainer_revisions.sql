alter table public.travel_group_retainers
  add column if not exists revisions_included integer check (revisions_included >= 0);
comment on column public.travel_group_retainers.revisions_included is 'Number of planning revisions included in this group-specific retainer agreement.';
