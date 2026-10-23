-- =========================================================
-- USD pricing: show prices in US dollars, charge in Ghana cedis.
-- Run after migration-deposits.sql. Safe to run once, and safe to re-run.
-- Paste the whole file into the SQL Editor.
--
-- Additive only: nothing changes until an admin picks USD in Admin → Settings.
-- The ledger (bookings.total_amount, payments, refunds, deposits) stays in GHS,
-- because that's what Paystack charges.
-- =========================================================

-- Which currency unit prices (units.base_price_per_night) and fixed promo amounts are in.
alter table property_settings add column if not exists price_currency text not null default 'GHS';
do $$ begin
  alter table property_settings add constraint property_settings_price_currency_check
    check (price_currency in ('GHS', 'USD'));
exception when duplicate_object then null; end $$;

-- Cedis per US dollar, used to convert a USD total into the GHS charge at booking time.
alter table property_settings add column if not exists usd_to_ghs_rate numeric(10,4);

-- What the guest saw when booking, kept for display. Null for bookings priced in GHS.
alter table bookings add column if not exists display_currency text;
alter table bookings add column if not exists display_total numeric(10,2);
alter table bookings add column if not exists exchange_rate numeric(10,4);

-- ROLLBACK (only after redeploying an app version that doesn't use these columns):
-- alter table bookings drop column if exists exchange_rate;
-- alter table bookings drop column if exists display_total;
-- alter table bookings drop column if exists display_currency;
-- alter table property_settings drop column if exists usd_to_ghs_rate;
-- alter table property_settings drop constraint if exists property_settings_price_currency_check;
-- alter table property_settings drop column if exists price_currency;
