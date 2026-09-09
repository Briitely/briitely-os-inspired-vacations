create table if not exists public.email_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google','microsoft')),
  email text not null,
  provider_user_id text,
  refresh_token_encrypted text not null,
  scopes text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_connections enable row level security;

comment on table public.email_connections is 'Server-only OAuth mailbox connections. Accessed with the Supabase service role; refresh tokens are encrypted by the app before storage.';
