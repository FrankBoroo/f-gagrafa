-- =========================================================
-- Portal verification, editable guest info, door codes, cancellations & refunds
-- Safe to run once, and safe to re-run. Paste the whole file into the SQL Editor.
-- =========================================================

-- Guest portal: failed/successful verification attempts (brute-force protection).
-- RLS is on with no policies, so only the server's service key can touch it.
create table if not exists portal_access_attempts (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_portal_attempts_code on portal_access_attempts (booking_code, created_at);
alter table portal_access_attempts enable row level security;

-- Settings: guest-facing details shown in the guest portal and on the Contact page.
alter table property_settings add column if not exists wifi_network text;
alter table property_settings add column if not exists wifi_password text;
alter table property_settings add column if not exists entry_instructions text;
alter table property_settings add column if not exists house_rules text;
alter table property_settings add column if not exists emergency_contact text;
alter table property_settings add column if not exists reception_hours text;

-- Per-residence door codes. Deliberately NOT a column on `units`: the public site reads
-- units with the public key, so anything stored there would be visible to everyone.
-- RLS on with no policies = only the server's service key can read or write it.
create table if not exists unit_access_codes (
  unit_id uuid primary key references units(id) on delete cascade,
  access_code text not null,
  updated_at timestamptz not null default now()
);
alter table unit_access_codes enable row level security;

-- Cancellations & refunds
alter table bookings add column if not exists cancelled_at timestamptz;
alter table bookings add column if not exists cancellation_reason text;
alter table bookings add column if not exists refunded_amount numeric(10,2) not null default 0;
