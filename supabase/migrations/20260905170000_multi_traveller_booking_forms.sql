-- Support traveller-specific booking forms and reusable contact/address details.

alter table public.traveller_profiles
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists province_state text,
  add column if not exists postal_zip text,
  add column if not exists country text;

alter table public.booking_form_sessions
  add column if not exists recipient_party_member_id uuid
    references public.travel_file_travellers(id) on delete cascade;

create index if not exists booking_form_sessions_recipient_party_member_idx
  on public.booking_form_sessions(recipient_party_member_id)
  where recipient_party_member_id is not null;

comment on column public.booking_form_sessions.recipient_party_member_id is
  'When set, this secure booking form is restricted to the specified traveller. Null means the primary booking form, which includes all travellers not marked for a separate booking form.';
