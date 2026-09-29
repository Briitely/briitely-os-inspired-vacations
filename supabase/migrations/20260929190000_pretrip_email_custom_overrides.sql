alter table public.travel_pretrip_emails add column if not exists custom_subject text;
alter table public.travel_pretrip_emails add column if not exists custom_body_html text;
alter table public.travel_pretrip_emails add column if not exists customized_at timestamptz;
alter table public.travel_pretrip_emails add column if not exists customized_by uuid references public.profiles(id);
