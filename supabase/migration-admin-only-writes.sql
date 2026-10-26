-- Admin-only writes for promo codes, settings and payments (security review of 2026-10-25,
-- finding #4).
--
-- Run order: after migration-rls-hardening.sql. Run the whole file once in the Supabase SQL
-- editor; it is idempotent and safe to run again.
--
-- Why: the app treats Promo Codes, Settings and Payments as admin-only, but the policies let
-- any staff account write them straight through the public anon key (for example a staff
-- member signing in with the anon key and creating a 100%-off code, changing the exchange
-- rate, or inserting a payment row). Staff keep read access.
--
-- Backward compatible: the app reads and writes these tables with the server's service-role
-- client, which bypasses RLS, so "Record payment" by staff and every admin page keep working.
-- No columns or tables change; only policies.

-- 1. PROMO CODES: staff may look, only admins may create, change or delete.
drop policy if exists "promo_codes: staff manage" on promo_codes;
drop policy if exists "promo_codes: staff read" on promo_codes;
create policy "promo_codes: staff read" on promo_codes for select using (is_staff());
drop policy if exists "promo_codes: admin manage" on promo_codes;
create policy "promo_codes: admin manage" on promo_codes for all
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- 2. SETTINGS (prices currency, exchange rate, deposit share): only admins change them.
drop policy if exists "property_settings: staff update" on property_settings;
drop policy if exists "property_settings: admin update" on property_settings;
create policy "property_settings: admin update" on property_settings for update
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- 3. PAYMENTS: only admins write rows directly (refunds are admin-only in the app too).
drop policy if exists "payments: staff write" on payments;
drop policy if exists "payments: admin insert" on payments;
create policy "payments: admin insert" on payments for insert with check (auth_role() = 'admin');
drop policy if exists "payments: staff update" on payments;
drop policy if exists "payments: admin update" on payments;
create policy "payments: admin update" on payments for update
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ROLLBACK (restores the previous staff-level policies; only if something unexpected breaks):
-- drop policy if exists "promo_codes: staff read" on promo_codes;
-- drop policy if exists "promo_codes: admin manage" on promo_codes;
-- create policy "promo_codes: staff manage" on promo_codes for all using (is_staff()) with check (is_staff());
-- drop policy if exists "property_settings: admin update" on property_settings;
-- create policy "property_settings: staff update" on property_settings for update using (is_staff());
-- drop policy if exists "payments: admin insert" on payments;
-- drop policy if exists "payments: admin update" on payments;
-- create policy "payments: staff write" on payments for insert with check (is_staff());
-- create policy "payments: staff update" on payments for update using (is_staff());

-- AFTER RUNNING: this should list the new policies (staff read, admin write) for the three tables:
-- select tablename, policyname, cmd from pg_policies
-- where tablename in ('promo_codes', 'property_settings', 'payments') order by 1, 2;
