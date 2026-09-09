alter table public.profiles
  add column if not exists sender_email text;

update public.profiles
set sender_email = email
where sender_email is null and email is not null;
