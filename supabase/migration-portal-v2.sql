-- Phase 4 guest portal: door codes per room, breakfast and airport transfer requests.
-- Run after supabase/migration-admin.sql, with the Phase 4 deploy. Additive and idempotent.
-- Nothing in this file uses the new enum values, so it is safe to run in one go in the SQL editor.

-- Door code per physical room. Service role only, like unit_access_codes: no policies on purpose.
-- unit_access_codes stays in place but the app no longer reads it.
create table if not exists room_access_codes (
  room_id uuid primary key references rooms(id) on delete cascade,
  access_code text not null check (char_length(access_code) between 1 and 40),
  updated_at timestamptz not null default now()
);

alter table room_access_codes enable row level security;
-- No policies: service role only.

alter type service_request_type add value if not exists 'breakfast';
alter type service_request_type add value if not exists 'airport_transfer';

-- ROLLBACK
-- Run only after rolling the app back. DATA LOSS: door codes per room.
-- The enum values 'breakfast' and 'airport_transfer' stay: Postgres cannot drop enum values,
-- and older code never writes them, so they are harmless.
-- drop table if exists room_access_codes;
