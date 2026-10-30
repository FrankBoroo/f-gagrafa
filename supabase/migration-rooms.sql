-- =========================================================
-- Rooms: guests book an apartment type, the server pencils in one of its physical rooms.
-- Run after migration-admin-only-writes.sql. Safe to re-run. Paste the whole file into the
-- SQL Editor.
--
-- NOT backward compatible with the app on `main`: the old app inserts bookings without a
-- room, which bookings_room_required refuses. Run this with the deploy that writes rooms,
-- immediately followed by supabase/reset-and-seed.sql (rooms are created there).
-- =========================================================

-- Monthly rate for stays of 30 nights or more. Null means the type has none.
alter table units add column if not exists monthly_price numeric(10,2);

-- The physical rooms. `units` stays the apartment type shown to guests.
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete restrict,
  number int not null unique check (number > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_rooms_unit on rooms (unit_id);

-- Service role only, like unit_access_codes: no policies on purpose.
alter table rooms enable row level security;

alter table bookings add column if not exists room_id uuid references rooms(id) on delete restrict;
-- False until staff confirm the pencilled-in room. Guests only see a confirmed room.
alter table bookings add column if not exists room_confirmed boolean not null default false;
create index if not exists idx_bookings_room_dates on bookings (room_id, check_in, check_out);

-- A row with a null room_id blocks every room of its type.
alter table blocked_dates add column if not exists room_id uuid references rooms(id) on delete cascade;

-- The double-booking guard moves from the type to the room: one type now has several rooms,
-- so the old constraint would refuse a second booking of a type with a free room.
alter table bookings drop constraint if exists bookings_no_overlap;
alter table bookings drop constraint if exists bookings_no_room_overlap;
alter table bookings add constraint bookings_no_room_overlap
  exclude using gist (
    room_id with =,
    daterange(check_in, check_out) with &&
  ) where (status <> 'cancelled' and status <> 'no_show' and room_id is not null);

-- A live booking without a room would escape the guard above. NOT VALID skips rows already
-- in the table, but any later update of such a row is still checked.
alter table bookings drop constraint if exists bookings_room_required;
alter table bookings add constraint bookings_room_required
  check (room_id is not null or status in ('cancelled', 'no_show')) not valid;

-- Same hold rule as is_unit_available(): an unpaid checkout stops counting after 30 minutes.
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
  );
$$;

create or replace function free_rooms_for_type(
  p_unit_id uuid, p_check_in date, p_check_out date, p_exclude_booking_id uuid default null
) returns table (id uuid, number int) language sql stable set search_path = public as $$
  select r.id, r.number
  from rooms r
  where r.unit_id = p_unit_id
    and r.is_active
    and is_room_available(r.id, p_check_in, p_check_out, p_exclude_booking_id)
  order by r.number;
$$;

revoke all on function is_room_available(uuid, date, date, uuid) from public, anon, authenticated;
grant execute on function is_room_available(uuid, date, date, uuid) to service_role;
revoke all on function free_rooms_for_type(uuid, date, date, uuid) from public, anon, authenticated;
grant execute on function free_rooms_for_type(uuid, date, date, uuid) to service_role;

-- ROLLBACK
-- Run only after rolling the app back. DATA LOSS: room assignments, per-room blocks and
-- monthly prices. Bookings that overlap within a type (different rooms) must be resolved
-- first, or re-adding bookings_no_overlap fails.
-- drop function if exists free_rooms_for_type(uuid, date, date, uuid);
-- drop function if exists is_room_available(uuid, date, date, uuid);
-- alter table bookings drop constraint if exists bookings_room_required;
-- alter table bookings drop constraint if exists bookings_no_room_overlap;
-- alter table bookings add constraint bookings_no_overlap
--   exclude using gist (
--     unit_id with =,
--     daterange(check_in, check_out) with &&
--   ) where (status <> 'cancelled' and status <> 'no_show');
-- alter table blocked_dates drop column if exists room_id;
-- drop index if exists idx_bookings_room_dates;
-- alter table bookings drop column if exists room_confirmed;
-- alter table bookings drop column if exists room_id;
-- drop table if exists rooms;
-- alter table units drop column if exists monthly_price;
