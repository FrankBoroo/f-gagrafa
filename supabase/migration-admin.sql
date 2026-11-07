-- Admin (Phase 3 of the redesign): room cleaning time, a "handled" mark for payment
-- problems, date-based special prices, and staff notes on guests.
-- Run after supabase/migration-rooms.sql. Idempotent: safe to run more than once.
-- Additive only, so the app before this change keeps working.

-- When a room was last cleaned. "Needs cleaning" is worked out from this and the stays.
alter table rooms add column if not exists last_cleaned_at timestamptz;

-- Staff marked a flagged payment (mismatch, paid after cancellation, paid but not
-- confirmed) as handled, so it leaves Today's "Needs attention".
alter table bookings add column if not exists attention_cleared_at timestamptz;

-- Special nightly prices and minimum stays for date ranges, per apartment type.
-- end_date is exclusive, like bookings' check_out: 24 → 27 Dec covers the nights of 24, 25, 26.
create table if not exists special_prices (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  nightly_price numeric(10,2),
  min_nights int,
  label text,
  created_at timestamptz not null default now()
);

alter table special_prices drop constraint if exists special_prices_dates;
alter table special_prices add constraint special_prices_dates check (end_date > start_date);
alter table special_prices drop constraint if exists special_prices_price_positive;
alter table special_prices add constraint special_prices_price_positive check (nightly_price is null or nightly_price > 0);
alter table special_prices drop constraint if exists special_prices_min_nights_range;
alter table special_prices add constraint special_prices_min_nights_range check (min_nights is null or min_nights between 1 and 365);
alter table special_prices drop constraint if exists special_prices_something_set;
alter table special_prices add constraint special_prices_something_set check (nightly_price is not null or min_nights is not null);
alter table special_prices drop constraint if exists special_prices_label_length;
alter table special_prices add constraint special_prices_label_length check (label is null or char_length(label) <= 80);

-- One special price per night per type, so a night's price is never ambiguous.
alter table special_prices drop constraint if exists special_prices_no_overlap;
alter table special_prices add constraint special_prices_no_overlap
  exclude using gist (unit_id with =, daterange(start_date, end_date) with &&);

create index if not exists idx_special_prices_unit_dates on special_prices (unit_id, start_date, end_date);

alter table special_prices enable row level security;
drop policy if exists "special_prices: staff read" on special_prices;
create policy "special_prices: staff read" on special_prices for select using (is_staff());
-- No write policies: the app writes through the service role after isAdmin().

-- Staff notes on a guest, keyed by lower-cased email (guests have no accounts).
create table if not exists guest_notes (
  email text primary key,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

alter table guest_notes drop constraint if exists guest_notes_email_lower;
alter table guest_notes add constraint guest_notes_email_lower check (email = lower(email));
alter table guest_notes drop constraint if exists guest_notes_length;
alter table guest_notes add constraint guest_notes_length check (char_length(notes) <= 2000);

alter table guest_notes enable row level security;
-- No policies: service role only.

-- ROLLBACK
-- Run only after rolling the app back. DATA LOSS: special prices, guest notes, cleaning times.
-- drop table if exists guest_notes;
-- drop table if exists special_prices;
-- alter table bookings drop column if exists attention_cleared_at;
-- alter table rooms drop column if exists last_cleaned_at;
