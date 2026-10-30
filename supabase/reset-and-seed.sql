-- DELETES ALL BOOKINGS, PAYMENTS, UNITS AND ROOMS. Run once, by hand, when wiping the database before launch.
-- Run after supabase/migration-rooms.sql. Keeps staff logins (profiles), Settings and Tour photos.
-- Check the USD exchange rate in Admin → Settings afterwards: this script doesn't set it.

truncate payments, service_requests, reviews, bookings, blocked_dates, unit_access_codes,
  contact_messages, audit_log, portal_access_attempts, rate_limit_hits, promo_codes, rooms, units
  restart identity cascade;

-- The five apartment types. Descriptions and photos are added in Phase 2.
insert into units (name, slug, type, base_price_per_night, monthly_price, max_guests, bedrooms, sort_order) values
  ('Studio',          'studio',            'studio',         100, null, 2, 1, 1),
  ('1-Bed Standard',  'one-bed-standard',  '1bed_standard',  170, 1500, 2, 1, 2),
  ('1-Bed Executive', 'one-bed-executive', '1bed_executive', 200, 2000, 2, 1, 3),
  ('2-Bed Executive', 'two-bed-executive', '2bed',           250, 2500, 2, 2, 4),
  ('Penthouse',       'penthouse',         'penthouse',      300, 2500, 2, 1, 5); -- Penthouse bedrooms: owner to confirm

-- The 13 rooms (owner facts).
insert into rooms (number, unit_id)
select v.number, u.id
from (values
  (1, 'studio'),
  (2, 'one-bed-executive'),
  (3, 'one-bed-standard'),
  (4, 'two-bed-executive'),
  (5, 'one-bed-standard'),
  (6, 'two-bed-executive'),
  (7, 'one-bed-standard'),
  (8, 'one-bed-executive'),
  (9, 'one-bed-executive'),
  (10, 'one-bed-standard'),
  (11, 'one-bed-executive'),
  (12, 'one-bed-executive'),
  (13, 'penthouse')
) as v(number, slug)
join units u on u.slug = v.slug;

update property_settings set price_currency = 'USD', deposit_percent = 50;
