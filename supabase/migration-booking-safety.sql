-- =========================================================
-- Booking safety migration
-- Run PART 1, then PART 2 (steps A, B, C one at a time).
-- Part 1 is safe to re-run. Don't run the whole file in one go:
-- if Part 2 fails (see step B) it would undo Part 1 with it.
-- =========================================================


-- ---------------------------------------------------------
-- PART 1 — functions (run this first, all at once)
-- ---------------------------------------------------------

-- An unpaid checkout stops blocking dates after 30 minutes.
create or replace function is_unit_available(
  p_unit_id uuid, p_check_in date, p_check_out date, p_exclude_booking_id uuid default null
) returns boolean language sql stable as $$
  select not exists (
    select 1 from bookings
    where unit_id = p_unit_id
      and status not in ('cancelled', 'no_show')
      and not (status = 'pending' and payment_status = 'unpaid' and created_at < now() - interval '30 minutes')
      and (p_exclude_booking_id is null or id <> p_exclude_booking_id)
      and daterange(check_in, check_out) && daterange(p_check_in, p_check_out)
  ) and not exists (
    select 1 from blocked_dates
    where unit_id = p_unit_id
      and daterange(start_date, end_date) && daterange(p_check_in, p_check_out)
  );
$$;

-- Actually cancels those stale holds (called by the booking flow and the daily cron job).
create or replace function expire_stale_pending_bookings() returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update bookings
     set status = 'cancelled',
         admin_notes = trim(both E'\n' from coalesce(admin_notes, '') || E'\nAuto-cancelled: unpaid checkout expired after 30 minutes')
   where status = 'pending'
     and payment_status = 'unpaid'
     and created_at < now() - interval '30 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- These two run with elevated rights, so the public API must not be able to call them
-- (otherwise anyone could burn promo-code uses). Only the server's service key can.
revoke all on function expire_stale_pending_bookings() from public, anon, authenticated;
grant execute on function expire_stale_pending_bookings() to service_role;

do $$ begin
  revoke all on function increment_promo_usage(text) from public, anon, authenticated;
  grant execute on function increment_promo_usage(text) to service_role;
exception when undefined_function then null;  -- promo codes migration not run yet; fine
end $$;


-- ---------------------------------------------------------
-- PART 2 — the database-level double-booking guard
-- ---------------------------------------------------------

-- STEP A (run on its own): clear out expired holds first.
select expire_stale_pending_bookings();

-- STEP B (run on its own): look for bookings that already overlap.
-- This should return NO ROWS. If it returns rows, cancel the extras, e.g.
--   update bookings set status = 'cancelled' where booking_code in ('GAG-2026-XXXX');
-- then run this query again until it is empty.
select a.booking_code as booking_a, b.booking_code as booking_b,
       a.unit_id, a.check_in as a_in, a.check_out as a_out, b.check_in as b_in, b.check_out as b_out
from bookings a
join bookings b
  on a.unit_id = b.unit_id and a.id < b.id
 and daterange(a.check_in, a.check_out) && daterange(b.check_in, b.check_out)
where a.status not in ('cancelled', 'no_show')
  and b.status not in ('cancelled', 'no_show');

-- STEP C (run on its own, only once step B is empty):
create extension if not exists btree_gist;

alter table bookings drop constraint if exists bookings_no_overlap;
alter table bookings add constraint bookings_no_overlap
  exclude using gist (
    unit_id with =,
    daterange(check_in, check_out) with &&
  ) where (status <> 'cancelled' and status <> 'no_show');

-- ROLLBACK
-- This migration only adds things, so the previous app version keeps working with it in
-- place: to undo a bad deploy, roll back the app in Vercel and leave the database alone.
-- Only run the statements below if the schema itself must go, after rolling back the app.
-- Removing the overlap guard re-opens double booking; prefer fixing forward.
-- alter table bookings drop constraint if exists bookings_no_overlap;
-- drop function if exists expire_stale_pending_bookings();
-- Then re-create the original is_unit_available() from supabase/schema.sql (the version
-- without the 30-minute pending-hold rule).
