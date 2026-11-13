-- Phase 5 Airbnb sync: calendar links per room, imported Airbnb reservations, and availability that counts them.
-- Run after supabase/migration-portal-v2.sql, with the Phase 5 deploy. Additive and idempotent.

-- Per-room calendar settings. The export token is the secret in the iCal feed URL; the default
-- gives every existing room its own token when the column is added.
alter table rooms add column if not exists ical_export_token text not null unique
  default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
alter table rooms add column if not exists airbnb_ical_url text
  check (airbnb_ical_url is null or char_length(airbnb_ical_url) <= 500);
alter table rooms add column if not exists airbnb_synced_at timestamptz;
alter table rooms add column if not exists airbnb_sync_error text;

-- Reservations read from a room's Airbnb calendar. A row that disappears from the feed gets
-- removed_at set instead of being deleted. Service role only: no policies on purpose.
create table if not exists external_reservations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  source text not null default 'airbnb' check (source = 'airbnb'),
  uid text not null,
  check_in date not null,
  check_out date not null check (check_out > check_in),
  summary text,
  guest_name text check (char_length(guest_name) <= 120),
  notes text check (char_length(notes) <= 1000),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz default now(),
  unique (room_id, uid)
);

create index if not exists idx_external_reservations_room_dates
  on external_reservations (room_id, check_in, check_out) where removed_at is null;

alter table external_reservations enable row level security;
-- No policies: service role only.

-- Same rule as migration-rooms.sql, plus: a live Airbnb reservation makes the room unavailable.
create or replace function is_room_available(
  p_room_id uuid, p_check_in date, p_check_out date, p_exclude_booking_id uuid default null
) returns boolean language sql stable set search_path = public as $$
  select not exists (
    select 1 from bookings
    where room_id = p_room_id
      and status not in ('cancelled', 'no_show')
      and not (status = 'pending' and payment_status = 'unpaid' and created_at < now() - interval '30 minutes')
      and (p_exclude_booking_id is null or id <> p_exclude_booking_id)
      and daterange(check_in, check_out) && daterange(p_check_in, p_check_out)
  ) and not exists (
    select 1 from blocked_dates b
    where (b.room_id = p_room_id
           or (b.room_id is null and b.unit_id = (select r.unit_id from rooms r where r.id = p_room_id)))
      and daterange(b.start_date, b.end_date) && daterange(p_check_in, p_check_out)
  ) and not exists (
    select 1 from external_reservations e
    where e.room_id = p_room_id
      and e.removed_at is null
      and daterange(e.check_in, e.check_out) && daterange(p_check_in, p_check_out)
  );
$$;

revoke all on function is_room_available(uuid, date, date, uuid) from public, anon, authenticated;
grant execute on function is_room_available(uuid, date, date, uuid) to service_role;

-- ROLLBACK
-- Run only after rolling the app back. DATA LOSS: imported reservations, calendar links and export tokens.
-- Restore the previous availability function first, then drop what it no longer reads.
-- create or replace function is_room_available(
--   p_room_id uuid, p_check_in date, p_check_out date, p_exclude_booking_id uuid default null
-- ) returns boolean language sql stable set search_path = public as $fn$
--   select not exists (
--     select 1 from bookings
--     where room_id = p_room_id
--       and status not in ('cancelled', 'no_show')
--       and not (status = 'pending' and payment_status = 'unpaid' and created_at < now() - interval '30 minutes')
--       and (p_exclude_booking_id is null or id <> p_exclude_booking_id)
--       and daterange(check_in, check_out) && daterange(p_check_in, p_check_out)
--   ) and not exists (
--     select 1 from blocked_dates b
--     where (b.room_id = p_room_id
--            or (b.room_id is null and b.unit_id = (select r.unit_id from rooms r where r.id = p_room_id)))
--       and daterange(b.start_date, b.end_date) && daterange(p_check_in, p_check_out)
--   );
-- $fn$;
-- revoke all on function is_room_available(uuid, date, date, uuid) from public, anon, authenticated;
-- grant execute on function is_room_available(uuid, date, date, uuid) to service_role;
-- drop table if exists external_reservations;
-- alter table rooms drop column if exists airbnb_sync_error;
-- alter table rooms drop column if exists airbnb_synced_at;
-- alter table rooms drop column if exists airbnb_ical_url;
-- alter table rooms drop column if exists ical_export_token;
