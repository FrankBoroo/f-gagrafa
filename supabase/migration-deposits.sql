-- =========================================================
-- Deposits: let guests reserve by paying part of the total now.
-- Safe to run once, and safe to re-run. Paste the whole file into the SQL Editor.
-- =========================================================

-- Percentage of the total taken as a deposit (0 turns deposits off). Editable in Admin → Settings.
alter table property_settings add column if not exists deposit_percent int not null default 50;

-- What was charged up front for a deposit booking (null for pay-in-full bookings).
alter table bookings add column if not exists deposit_amount numeric(10,2);

-- ROLLBACK
-- This migration only adds things, so the previous app version keeps working with it in
-- place: to undo a bad deploy, roll back the app in Vercel and leave the database alone.
-- Only run the statements below if the schema itself must go, after rolling back the app.
-- DATA LOSS: bookings lose the record of which were deposit bookings and how much was due.
-- alter table bookings drop column if exists deposit_amount;
-- alter table property_settings drop column if exists deposit_percent;
