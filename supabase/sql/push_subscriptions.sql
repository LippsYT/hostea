-- Optional bootstrap for Supabase projects (if table not created by Prisma db push)
create table if not exists public.push_subscriptions (
  id text primary key,
  host_id text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists push_subscriptions_host_id_is_active_idx
  on public.push_subscriptions(host_id, is_active);

