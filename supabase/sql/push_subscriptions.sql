-- Hostea push subscriptions bootstrap (Supabase SQL Editor)
-- Note: Hostea user IDs are string (cuid), so user reference is stored in host_id.

create extension if not exists pgcrypto;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  host_id text not null,
  role text not null default 'host' check (role in ('host', 'client')),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true
);

alter table public.push_subscriptions
  add column if not exists role text not null default 'host';

alter table public.push_subscriptions
  add column if not exists is_active boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_subscriptions_role_check'
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_role_check
      check (role in ('host', 'client'));
  end if;
end $$;

create index if not exists push_subscriptions_host_role_active_idx
  on public.push_subscriptions(host_id, role, is_active);

alter table public.push_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'own_push_subscriptions_select'
  ) then
    create policy own_push_subscriptions_select
      on public.push_subscriptions
      for select
      to authenticated
      using (host_id = auth.uid()::text);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'own_push_subscriptions_insert'
  ) then
    create policy own_push_subscriptions_insert
      on public.push_subscriptions
      for insert
      to authenticated
      with check (host_id = auth.uid()::text);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'own_push_subscriptions_update'
  ) then
    create policy own_push_subscriptions_update
      on public.push_subscriptions
      for update
      to authenticated
      using (host_id = auth.uid()::text)
      with check (host_id = auth.uid()::text);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'own_push_subscriptions_delete'
  ) then
    create policy own_push_subscriptions_delete
      on public.push_subscriptions
      for delete
      to authenticated
      using (host_id = auth.uid()::text);
  end if;
end $$;
