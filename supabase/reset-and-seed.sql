-- DELETES ALL BOOKINGS, PAYMENTS, UNITS AND ROOMS. Run once, by hand, when wiping the database before launch.
-- Run after supabase/migration-admin.sql. Keeps staff logins (profiles) and Tour photos.
-- Settings keep their values, except the address, contact details, reception hours, price currency and down payment set at the end.
-- Check the USD exchange rate in Admin → Settings afterwards: this script doesn't set it.

truncate payments, service_requests, reviews, bookings, blocked_dates, unit_access_codes,
  contact_messages, audit_log, portal_access_attempts, rate_limit_hits, promo_codes, special_prices, guest_notes, rooms, units
  restart identity cascade;

-- The five apartment types. Photos live in public/apartments/<slug>/.
insert into units (name, slug, type, base_price_per_night, monthly_price, max_guests, bedrooms, sort_order, images) values
  ('Studio',          'studio',            'studio',         100, null, 2, 1, 1,
   '["/apartments/studio/1.jpg","/apartments/studio/2.jpg","/apartments/studio/3.jpg","/apartments/studio/4.jpg"]'),
  ('1-Bed Standard',  'one-bed-standard',  '1bed_standard',  170, 1500, 2, 1, 2,
   '["/apartments/one-bed-standard/1.jpg","/apartments/one-bed-standard/2.jpg","/apartments/one-bed-standard/3.jpg","/apartments/one-bed-standard/4.jpg","/apartments/one-bed-standard/5.jpg"]'),
  ('1-Bed Executive', 'one-bed-executive', '1bed_executive', 200, 2000, 2, 1, 3,
   '["/apartments/one-bed-executive/1.jpg","/apartments/one-bed-executive/2.jpg","/apartments/one-bed-executive/3.jpg","/apartments/one-bed-executive/4.jpg"]'),
  ('2-Bed Executive', 'two-bed-executive', '2bed',           250, 2500, 2, 2, 4,
   '["/apartments/two-bed-executive/1.jpg","/apartments/two-bed-executive/2.jpg","/apartments/two-bed-executive/3.jpg","/apartments/two-bed-executive/4.jpg","/apartments/two-bed-executive/5.jpg"]'),
  ('Penthouse',       'penthouse',         'penthouse',      300, 2500, 2, 1, 5,
   '["/apartments/penthouse/1.jpg","/apartments/penthouse/2.jpg","/apartments/penthouse/3.jpg","/apartments/penthouse/4.jpg","/apartments/penthouse/5.jpg"]'); -- Penthouse bedrooms: owner to confirm

-- The old site has one description for every type; room-specific text can be added in Admin.
update units set description = 'The Gagrafa combines the elegance of a luxury hotel with the cozy, relaxing atmosphere of a home. A serene escape for business, leisure or a quick getaway, a short drive from the city''s business district.';

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

update property_settings set
  price_currency = 'USD',
  deposit_percent = 50,
  address = 'Militia Street, Mango Link, Tema, Community 20',
  contact_phone = '0303 400 535 / 059 381 0182',
  contact_email = 'info@thegagrafa.com',
  reception_hours = '';
