-- =========================================================
-- The Gagrafa — Supabase schema, RLS policies, seed data
-- Run this in the Supabase SQL editor (or via `supabase db push`)
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------- ENUM TYPES ----------
create type user_role as enum ('guest', 'admin', 'staff');
create type unit_type as enum ('studio', '1bed_standard', '1bed_executive', '2bed', 'penthouse');
create type booking_status as enum ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show');
create type payment_status as enum ('unpaid', 'paid', 'partial', 'refunded');
create type payment_method as enum ('paystack', 'momo', 'cash', 'bank');
create type service_request_type as enum ('cleaning', 'towels', 'maintenance', 'other');
create type service_request_status as enum ('pending', 'in_progress', 'completed', 'cancelled');
create type booking_currency as enum ('GHS', 'USD');

-- ---------- PROFILES ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role user_role not null default 'guest',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- UNITS ----------
create table units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type unit_type not null,
  description text,
  short_description text,
  base_price_per_night numeric(10,2) not null,
  max_guests int not null default 2,
  bedrooms int not null default 1,
  bathrooms int not null default 1,
  size_sqm numeric(6,2),
  amenities jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- BOOKINGS ----------
create table bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique,
  unit_id uuid not null references units(id) on delete restrict,
  guest_id uuid references profiles(id) on delete set null,
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  check_in date not null,
  check_out date not null,
  nights int generated always as (check_out - check_in) stored,
  adults int not null default 1,
  children int not null default 0,
  total_amount numeric(10,2) not null,
  currency booking_currency not null default 'GHS',
  status booking_status not null default 'pending',
  payment_status payment_status not null default 'unpaid',
  special_requests text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_dates check (check_out > check_in)
);

create index idx_bookings_unit_dates on bookings (unit_id, check_in, check_out);
create index idx_bookings_guest on bookings (guest_id);
create index idx_bookings_code on bookings (booking_code);

-- ---------- PAYMENTS ----------
create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  amount numeric(10,2) not null,
  currency booking_currency not null default 'GHS',
  method payment_method not null,
  paystack_reference text unique,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_payments_booking on payments (booking_id);

-- ---------- SERVICE REQUESTS ----------
create table service_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  type service_request_type not null,
  description text,
  status service_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_service_requests_booking on service_requests (booking_id);

-- ---------- REVIEWS ----------
create table reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- BLOCKED DATES ----------
create table blocked_dates (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  constraint valid_block_dates check (end_date > start_date)
);

create index idx_blocked_dates_unit on blocked_dates (unit_id, start_date, end_date);

-- ---------- CONTACT MESSAGES ----------
create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- PROPERTY SETTINGS (singleton row) ----------
create table property_settings (
  id uuid primary key default gen_random_uuid(),
  property_name text not null default 'The Gagrafa',
  tagline text default 'Live Luxuriously, Stay Serenely',
  contact_phone text,
  contact_email text,
  address text default 'Spintex, Community 20, Accra, Ghana',
  admin_notification_email text,
  whatsapp_number text,
  updated_at timestamptz not null default now()
);

insert into property_settings (property_name, tagline, address)
values ('The Gagrafa', 'Live Luxuriously, Stay Serenely', 'Spintex, Community 20, Accra, Ghana');

-- =========================================================
-- HELPER: current user's role (avoids recursive RLS lookups)
-- =========================================================
create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in ('admin','staff'), false);
$$;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table profiles enable row level security;
alter table units enable row level security;
alter table bookings enable row level security;
alter table payments enable row level security;
alter table service_requests enable row level security;
alter table reviews enable row level security;
alter table blocked_dates enable row level security;
alter table contact_messages enable row level security;
alter table property_settings enable row level security;

-- PROFILES
create policy "profiles: read own" on profiles for select using (auth.uid() = id or is_staff());
create policy "profiles: update own" on profiles for update using (auth.uid() = id or is_staff());
create policy "profiles: insert own" on profiles for insert with check (auth.uid() = id);

-- UNITS (public read of active units; staff full access)
create policy "units: public read active" on units for select using (is_active = true or is_staff());
create policy "units: staff write" on units for insert with check (is_staff());
create policy "units: staff update" on units for update using (is_staff());
create policy "units: staff delete" on units for delete using (is_staff());

-- BOOKINGS (guest sees own; staff sees all; anyone can create a booking via server route)
create policy "bookings: owner or staff read" on bookings for select
  using (auth.uid() = guest_id or is_staff());
create policy "bookings: staff write" on bookings for insert with check (true);
create policy "bookings: owner or staff update" on bookings for update
  using (auth.uid() = guest_id or is_staff());

-- PAYMENTS (visible to booking owner + staff)
create policy "payments: owner or staff read" on payments for select
  using (exists (select 1 from bookings b where b.id = booking_id and (b.guest_id = auth.uid() or is_staff())));
create policy "payments: staff write" on payments for insert with check (is_staff());
create policy "payments: staff update" on payments for update using (is_staff());

-- SERVICE REQUESTS
create policy "service_requests: owner or staff read" on service_requests for select
  using (exists (select 1 from bookings b where b.id = booking_id and (b.guest_id = auth.uid() or is_staff())));
create policy "service_requests: owner create" on service_requests for insert
  with check (exists (select 1 from bookings b where b.id = booking_id and (b.guest_id = auth.uid() or is_staff())));
create policy "service_requests: staff update" on service_requests for update using (is_staff());

-- REVIEWS (public reads published; owner can create for own booking; staff moderates)
create policy "reviews: public read published" on reviews for select using (is_published = true or is_staff());
create policy "reviews: owner create" on reviews for insert
  with check (exists (select 1 from bookings b where b.id = booking_id and b.guest_id = auth.uid()));
create policy "reviews: staff update" on reviews for update using (is_staff());

-- BLOCKED DATES (public read so availability calc works; staff writes)
create policy "blocked_dates: public read" on blocked_dates for select using (true);
create policy "blocked_dates: staff write" on blocked_dates for insert with check (is_staff());
create policy "blocked_dates: staff update" on blocked_dates for update using (is_staff());
create policy "blocked_dates: staff delete" on blocked_dates for delete using (is_staff());

-- CONTACT MESSAGES (anyone can submit; only staff can read/manage)
create policy "contact_messages: anyone can submit" on contact_messages for insert with check (true);
create policy "contact_messages: staff read" on contact_messages for select using (is_staff());
create policy "contact_messages: staff update" on contact_messages for update using (is_staff());

-- PROPERTY SETTINGS (staff only)
create policy "property_settings: staff read" on property_settings for select using (is_staff());
create policy "property_settings: staff update" on property_settings for update using (is_staff());

-- =========================================================
-- AVAILABILITY CHECK FUNCTION (prevents double-booking)
-- =========================================================
create or replace function is_unit_available(
  p_unit_id uuid, p_check_in date, p_check_out date, p_exclude_booking_id uuid default null
) returns boolean language sql stable as $$
  select not exists (
    select 1 from bookings
    where unit_id = p_unit_id
      and status not in ('cancelled', 'no_show')
      and (p_exclude_booking_id is null or id <> p_exclude_booking_id)
      and daterange(check_in, check_out) && daterange(p_check_in, p_check_out)
  ) and not exists (
    select 1 from blocked_dates
    where unit_id = p_unit_id
      and daterange(start_date, end_date) && daterange(p_check_in, p_check_out)
  );
$$;

-- =========================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =========================================================
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'guest');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =========================================================
-- SEED DATA — real Gagrafa unit types
-- =========================================================
insert into units (name, slug, type, description, short_description, base_price_per_night, max_guests, bedrooms, bathrooms, size_sqm, amenities, images, sort_order) values
('Studio Suite', 'studio-suite', 'studio',
 'A refined studio suite designed for the solo traveller or business guest who wants comfort without excess. Open-plan living and sleeping area with a kitchenette, fast Wi-Fi, and a private balcony overlooking Spintex.',
 'Compact, elegant studio for one or two guests.',
 1200, 2, 0, 1, 32,
 '["Free Wi-Fi", "Air Conditioning", "Smart TV", "Kitchenette", "24/7 Security", "Backup Power"]',
 '["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267"]', 1),
('One Bedroom Standard', '1-bedroom-standard', '1bed_standard',
 'A comfortable one-bedroom apartment with a separate living room, full kitchen, and workspace — ideal for short and medium stays.',
 'Separate bedroom and living area with full kitchen.',
 1900, 3, 1, 1, 48,
 '["Free Wi-Fi", "Air Conditioning", "Full Kitchen", "Washer", "Smart TV", "Workspace", "24/7 Security"]',
 '["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2"]', 2),
('One Bedroom Executive', '1-bedroom-executive', '1bed_executive',
 'An elevated one-bedroom residence with premium finishes, a soaking tub, and a wraparound balcony — for guests who expect more.',
 'Premium finishes, soaking tub, wraparound balcony.',
 2600, 3, 1, 1.5, 58,
 '["Free Wi-Fi", "Air Conditioning", "Full Kitchen", "Washer/Dryer", "Soaking Tub", "Smart TV", "Gym Access", "Pool Access"]',
 '["https://images.unsplash.com/photo-1631889993959-41b4e9c6e3c5"]', 3),
('Two Bedroom Apartment', '2-bedroom-apartment', '2bed',
 'Spacious two-bedroom apartment suited to families or small groups, with two full bathrooms and a generous living and dining area.',
 'Two bedrooms, two baths — perfect for families.',
 3800, 5, 2, 2, 85,
 '["Free Wi-Fi", "Air Conditioning", "Full Kitchen", "Washer/Dryer", "Smart TVs", "Gym Access", "Pool Access", "24/7 Security"]',
 '["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688"]', 4),
('The Penthouse', 'penthouse', 'penthouse',
 'The Gagrafa''s signature residence: a top-floor penthouse with panoramic Accra views, a private terrace, and bespoke interiors for guests who stay luxuriously.',
 'Signature top-floor residence with private terrace.',
 6500, 6, 3, 3, 140,
 '["Free Wi-Fi", "Air Conditioning", "Full Kitchen", "Private Terrace", "Panoramic Views", "Butler on Request", "Gym Access", "Pool Access", "Valet Parking"]',
 '["https://images.unsplash.com/photo-1600607687939-ce8a6c25118c"]', 5);

-- =========================================================
-- ADDITIONS: reminders, promo codes, audit log
-- (Run this block on its own if your database already has the tables above —
-- it's written to be safe to run once, standalone, on an existing schema.)
-- =========================================================

-- Pre-arrival / post-stay email tracking (avoids double-sending from the cron job)
alter table bookings add column if not exists reminder_sent_at timestamptz;
alter table bookings add column if not exists review_request_sent_at timestamptz;
alter table bookings add column if not exists promo_code text;
alter table bookings add column if not exists discount_amount numeric(10,2) not null default 0;

-- ---------- PROMO CODES ----------
create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10,2) not null,
  max_uses int,
  used_count int not null default 0,
  valid_from date,
  valid_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table promo_codes enable row level security;
drop policy if exists "promo_codes: staff manage" on promo_codes;
create policy "promo_codes: staff manage" on promo_codes for all using (is_staff()) with check (is_staff());
-- Public can read active codes only to validate one at checkout (never lists them).
drop policy if exists "promo_codes: public read active" on promo_codes;
create policy "promo_codes: public read active" on promo_codes for select using (is_active = true);

-- Atomic increment, so two guests confirming payment at the same moment
-- can't both slip past a max_uses limit via a read-then-write race.
create or replace function increment_promo_usage(p_code text) returns void
language sql security definer set search_path = public as $$
  update promo_codes set used_count = used_count + 1 where code = p_code;
$$;

-- ---------- AUDIT LOG ----------
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table audit_log enable row level security;
drop policy if exists "audit_log: admin read" on audit_log;
create policy "audit_log: admin read" on audit_log for select using (auth_role() = 'admin');
-- Writes go through the service-role client only (src/lib/audit.ts) — no insert policy needed for anon/authenticated.

-- =========================================================
-- ADDITIONS 2: booking safety (stale-hold expiry + double-booking guard)
-- Existing databases: use supabase/migration-booking-safety.sql instead,
-- following its step-by-step instructions.
-- =========================================================
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


-- (Existing databases: see the overlap check in migration-booking-safety.sql before this step.)
create extension if not exists btree_gist;

alter table bookings drop constraint if exists bookings_no_overlap;
alter table bookings add constraint bookings_no_overlap
  exclude using gist (
    unit_id with =,
    daterange(check_in, check_out) with &&
  ) where (status <> 'cancelled' and status <> 'no_show');

-- =========================================================
-- ADDITIONS 3: portal verification, guest info settings, door codes, refunds
-- (Existing databases: run supabase/migration-portal-and-ops.sql instead.)
-- =========================================================
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

-- =========================================================
-- ADDITIONS 4: Tour / gallery page
-- (Existing databases: run supabase/migration-tour-gallery.sql instead.)
-- =========================================================
create table if not exists gallery_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('property', 'neighbourhood')),
  image_url text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_gallery_items_order on gallery_items (category, sort_order);

alter table gallery_items enable row level security;

-- The gallery is public content, so anyone may read it. There are deliberately no write
-- policies: only the server's service key (used by the admin) can add, edit or remove photos.
drop policy if exists "gallery_items: public read" on gallery_items;
create policy "gallery_items: public read" on gallery_items for select using (true);

-- =========================================================
-- ADDITIONS 5: deposits
-- (Existing databases: run supabase/migration-deposits.sql instead.)
-- =========================================================
alter table property_settings add column if not exists deposit_percent int not null default 50;

-- What was charged up front for a deposit booking (null for pay-in-full bookings).
alter table bookings add column if not exists deposit_amount numeric(10,2);
