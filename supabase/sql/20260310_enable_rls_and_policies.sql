-- Hostea: enable RLS on public tables and apply minimal safe client policies.
-- Date: 2026-03-10

begin;

-- Harden helper schema.
create schema if not exists app_private;
revoke all on schema app_private from public;
revoke all on schema app_private from anon;
revoke all on schema app_private from authenticated;

-- Resolve Hostea app user id (cuid text) from Supabase JWT email.
create or replace function app_private.current_app_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public."User" u
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1
$$;

revoke all on function app_private.current_app_user_id() from public;
grant execute on function app_private.current_app_user_id() to authenticated;

-- Enable RLS on all application tables in public.
do $$
declare
  t record;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename <> '_prisma_migrations'
  loop
    execute format('alter table public.%I enable row level security;', t.tablename);
  end loop;
end
$$;

-- Profile: user can read/update only own profile row.
drop policy if exists profile_select_own on public."Profile";
create policy profile_select_own
on public."Profile"
for select
to authenticated
using ("userId" = app_private.current_app_user_id());

drop policy if exists profile_update_own on public."Profile";
create policy profile_update_own
on public."Profile"
for update
to authenticated
using ("userId" = app_private.current_app_user_id())
with check ("userId" = app_private.current_app_user_id());

-- Listing: host can manage only own listings.
drop policy if exists listing_select_own on public."Listing";
create policy listing_select_own
on public."Listing"
for select
to authenticated
using ("hostId" = app_private.current_app_user_id());

drop policy if exists listing_insert_own on public."Listing";
create policy listing_insert_own
on public."Listing"
for insert
to authenticated
with check ("hostId" = app_private.current_app_user_id());

drop policy if exists listing_update_own on public."Listing";
create policy listing_update_own
on public."Listing"
for update
to authenticated
using ("hostId" = app_private.current_app_user_id())
with check ("hostId" = app_private.current_app_user_id());

drop policy if exists listing_delete_own on public."Listing";
create policy listing_delete_own
on public."Listing"
for delete
to authenticated
using ("hostId" = app_private.current_app_user_id());

-- Reservation: readable by guest owner or listing owner (host).
drop policy if exists reservation_select_guest_or_host on public."Reservation";
create policy reservation_select_guest_or_host
on public."Reservation"
for select
to authenticated
using (
  "userId" = app_private.current_app_user_id()
  or exists (
    select 1
    from public."Listing" l
    where l.id = "Reservation"."listingId"
      and l."hostId" = app_private.current_app_user_id()
  )
);

-- Ensure anon/authenticated do not get direct finance/admin table access.
-- (Service role / backend remains unaffected.)
revoke all on table public."AdminSettings" from anon, authenticated;
revoke all on table public."PrintJob" from anon, authenticated;
revoke all on table public."Payout" from anon, authenticated;
revoke all on table public."AuditLog" from anon, authenticated;
revoke all on table public."Settings" from anon, authenticated;
revoke all on table public."KycSubmission" from anon, authenticated;
revoke all on table public."LegalAcceptance" from anon, authenticated;
revoke all on table public."LegalPage" from anon, authenticated;
revoke all on table public."Payment" from anon, authenticated;

commit;

