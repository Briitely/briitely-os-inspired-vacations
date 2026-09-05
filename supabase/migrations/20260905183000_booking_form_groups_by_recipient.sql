-- Allow multiple travellers to share one booking form by assigning each traveller
-- to the party member who will receive/complete that form.

alter table public.travel_file_travellers
  add column if not exists booking_form_recipient_party_member_id uuid
    references public.travel_file_travellers(id) on delete set null;

create index if not exists travel_file_travellers_booking_form_recipient_idx
  on public.travel_file_travellers(booking_form_recipient_party_member_id)
  where booking_form_recipient_party_member_id is not null;

comment on column public.travel_file_travellers.booking_form_recipient_party_member_id is
  'Party member who receives and completes the booking form for this traveller. Null means the primary traveller/form for legacy records.';
