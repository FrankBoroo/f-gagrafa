-- Row Level Security hardening (Plan phase 1, RLS review of 2026-10-24).
--
-- Run order: after migration-rate-limits.sql. Run the whole file once in the Supabase SQL
-- editor; it is idempotent and safe to run again.
--
-- Why: the anon key is public (it ships in every browser), so these policies are the only
-- thing between the internet and the tables. The app itself reads and writes everything
-- through the server's service-role client, which bypasses RLS; the only RLS-bound reads are
-- the public residences and reviews lists, and a signed-in user reading their own profile.
-- So every change below is invisible to the app and closes a direct-API hole.
--
-- Backward compatible: no columns or tables change; only policies, grants and one trigger.

-- 1. PROFILES: nobody may give themselves a role. Before this, "profiles: update own" let
--    any signed-up user set role = 'admin' on their own row.
drop policy if exists "profiles: insert own" on profiles;
create policy "profiles: insert own" on profiles for insert
  with check (auth.uid() = id and role = 'guest');

-- Only an admin (or the server / SQL editor, where auth.uid() is null) may change a role,
-- and a profile's id never changes.
create or replace function protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profile id cannot change' using errcode = '42501';
  end if;
  if new.role is distinct from old.role
     and auth.uid() is not null
     and coalesce(auth_role()::text, '') <> 'admin' then
    raise exception 'only an admin can change a role' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on profiles;
create trigger profiles_protect_role
  before update on profiles
  for each row execute function protect_profile_role();

-- 2. BOOKINGS: inserts were open to anyone ("with check (true)"), so a fake confirmed, paid
--    booking could be written straight to the table. Guests book through the server.
drop policy if exists "bookings: staff write" on bookings;
drop policy if exists "bookings: staff insert" on bookings;
create policy "bookings: staff insert" on bookings for insert with check (is_staff());
-- Guests have no accounts (the portal uses a signed cookie), so only staff update bookings.
drop policy if exists "bookings: owner or staff update" on bookings;
drop policy if exists "bookings: staff update" on bookings;
create policy "bookings: staff update" on bookings for update using (is_staff()) with check (is_staff());

-- 3. PROMO CODES: "public read active" let anyone list every active code. Codes are checked
--    on the server (src/lib/booking/promo.ts) with the service key.
drop policy if exists "promo_codes: public read active" on promo_codes;

-- 4. CONTACT MESSAGES: direct inserts skipped the spam and rate-limit checks in
--    src/app/contact/actions.ts, which writes with the service key.
drop policy if exists "contact_messages: anyone can submit" on contact_messages;

-- 5. BLOCKED DATES: the public could read staff notes in `reason`. Availability is checked on
--    the server with the service key.
drop policy if exists "blocked_dates: public read" on blocked_dates;
drop policy if exists "blocked_dates: staff read" on blocked_dates;
create policy "blocked_dates: staff read" on blocked_dates for select using (is_staff());

-- (increment_promo_usage and expire_stale_pending_bookings are already server-only:
--  migration-booking-safety.sql revokes them from anon and authenticated.)

-- 6. INDEXES (same review): idx_bookings_code duplicates the index Postgres already keeps
--    for the unique constraint on bookings.booking_code; it only slows writes.
drop index if exists idx_bookings_code;

-- ROLLBACK (restores the previous, weaker policies; only if something unexpected breaks):
-- drop trigger if exists profiles_protect_role on profiles;
-- drop function if exists protect_profile_role();
-- drop policy if exists "profiles: insert own" on profiles;
-- create policy "profiles: insert own" on profiles for insert with check (auth.uid() = id);
-- drop policy if exists "bookings: staff insert" on bookings;
-- create policy "bookings: staff write" on bookings for insert with check (true);
-- drop policy if exists "bookings: staff update" on bookings;
-- create policy "bookings: owner or staff update" on bookings for update using (auth.uid() = guest_id or is_staff());
-- create policy "promo_codes: public read active" on promo_codes for select using (is_active = true);
-- create policy "contact_messages: anyone can submit" on contact_messages for insert with check (true);
-- drop policy if exists "blocked_dates: staff read" on blocked_dates;
-- create policy "blocked_dates: public read" on blocked_dates for select using (true);
-- (idx_bookings_code needs no rollback: lookups by booking_code use the unique index.)

-- AFTER RUNNING: check nobody already used the hole. This should list only your own team:
-- select p.id, u.email, p.role, p.created_at
-- from profiles p join auth.users u on u.id = p.id
-- where p.role in ('admin', 'staff') order by p.created_at;
