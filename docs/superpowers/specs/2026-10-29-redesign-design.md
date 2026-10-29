# The Gagrafa redesign: design

Date: 2026-10-29. Status: draft for the owner's approval.

## 1. Intent and why

The app is a proposal to the property manager: it should replace the current WordPress site (thegagrafa.com) with one system for direct bookings, guests and staff. The owner's words: "I don't want it to look AI", "a proper apartment page", "look naturally amazing". The manager has to be impressed by the public site, and the staff side has to match how the building really runs.

How the building runs (owner facts, 2026-10-29):

- 13 rooms, 5 types. Room 1 Studio; Rooms 3, 5, 7, 10 1-Bed Standard; Rooms 2, 8, 9, 11, 12 1-Bed Executive; Rooms 4, 6 2-Bed Executive; Room 13 Penthouse.
- Check-in 2 PM, check-out 11 AM. 2 adults per apartment.
- The rooms are also sold on Airbnb (airbnb.co.za). Booking.com is out of scope.

## 2. Goals

1. A new public site: photo-led, quiet, specific (reference: neseahydra.com), with real facts, photos and prices from thegagrafa.com.
2. Guests book an apartment **type**; the system pencils in a free **room**; staff confirm or change the room; the guest sees the room number only after staff confirm it.
3. Rules from the old site: monthly rates, down payment or pay in full for every stay, "one night charged if cancelled within 72 hours".
4. A simpler admin (15 menu items to 7) built around a **Today** page, plus the business helpers listed in section 7.
5. A guest portal where the guest can pay the balance, get a receipt, directions, WhatsApp reception, add the stay to a calendar, and see the room once assigned.
6. Two-way calendar sync with Airbnb, one Airbnb listing per room (13 listings).

## 3. Non-goals

- Booking.com in any form.
- New user roles (keep guest / staff / admin).
- A neighbourhood guide (maybe later). The portal's "Nearby" section is removed (its content was invented).
- A channel manager or any paid sync service.
- Rewriting what already works and is tested: payment confirmation, hold expiry, early hold release, webhook, rate limits, portal session, RLS model.

## 4. Anti-goals (would make this a failure even if it works)

- A site that looks templated or "AI": stock photos, invented facts, filler copy, theme imagery from the old site (St. Moritz wellness page, Mole Motel safari photos, 2018/2021 stock).
- Selling more rooms of a type than exist, or two bookings in one room on the same night.
- Any change that lets a cancelled booking come back to life, or confirms a payment twice.
- A guest seeing a room number, door code or Wi-Fi before staff have confirmed their room.

## 5. Constraints

- Stack stays: Next.js 15.5, Supabase, Paystack, Resend, Vercel Hobby. Rules in CLAUDE.md apply (env access, formatters, `isStaff()`/`isAdmin()` on every staff action, best-effort messaging).
- **Vercel Hobby cron runs at most once a day** ([Vercel docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)), so frequent Airbnb pulls need another trigger (section 8.4).
- Airbnb refreshes an imported calendar about every 3 hours ([Airbnb help 99](https://www.airbnb.com/help/article/99)): a gap remains, so clashes must be detected and shown, not assumed impossible.
- Prices are shown in USD and charged in GHS at the Settings rate (live since 2026-10-23).
- The owner will wipe the database before launch; a reset-and-seed script is provided. `schema.sql` is never re-run on an existing database.
- Photos: most old-site photos are 897 px wide; only 4 are 2560 px. Use 897 px photos in smaller editorial frames, never full-bleed; full-bleed uses the 2560 px ones.
- Work ships in batches; the owner OKs each commit and push. Work happens on a branch with a Vercel preview to show the manager.

## 6. Approaches

### 6.1 Overall approach (chosen 2026-10-27: A)

- **A. Rebuild the UI on the existing system, page by page, mockup first** (chosen). Keeps the tested payment, hold and security code; only the look and the booking model change.
- B. Start a fresh app and port pieces across. Rejected: throws away tested safety code for no gain.
- C. Restyle the current pages only. Rejected: cannot deliver rooms, monthly rates or the new admin.

### 6.2 Rooms model (chosen 2026-10-29: A)

- **A. Guests book a type; a free room is pencilled in; staff confirm or change** (chosen). Each room keeps its own calendar, door code, cleaning status and Airbnb link; the per-room overlap guard keeps working.
- B. List all 13 rooms publicly. Rejected: "1-Bed Executive 3" is wrong for a luxury site, and guests could be refused while a twin room is free.
- C. Count rooms per type without real rooms. Rejected: loses door codes, cleaning status and per-room Airbnb sync, and the overlap guard.

### 6.3 Airbnb (chosen 2026-10-29)

Booking.com's calendar sync allows only one unit per room type ([Booking.com partner help](https://partner.booking.com/en-us/help/rates-availability/extranet-calendar/syncing-your-bookingcom-calendar-third-party-calendars)); Booking.com is dropped. On Airbnb the owner first described one listing per type, then decided on **one Airbnb listing per room (13 listings)** so Airbnb can sell every room. The manager creates the extra listings.

## 7. What gets built (decided with the owner)

### 7.1 Public site

- **Homepage (direction A, mockup approved):** full-screen photo slideshow with the real Gagrafa logo centred (redrawn as SVG from thegagrafa.com `2025/02/logo-1.png`; white on photos, navy on light headers), "Live Luxuriously, Stay Serenely" / "Community 20 · Tema"; off-centre photo collage with welcome text; the five apartment types as large alternating rows with nightly and monthly prices; pool / gym / lounge photos; a navy "Find us" band; a sticky round Book / Call button.
- **Apartment page (mockup approved):** one large photo plus four; title and prices; facts line; old-site description; building amenities (pool, gym, lounge); "on request: breakfast · airport transfer"; the 72-hour rule and the address; sticky booking panel (dates, guests, down payment selected by default or pay in full, Paystack); other apartments.
- Facts and prices from thegagrafa.com. Nightly: Studio $100, 1-Bed Standard $170, 1-Bed Executive $200, 2-Bed Executive $250, Penthouse $300. Monthly: 1-Bed Standard $1,500, 1-Bed Executive $2,000, 2-Bed Executive $2,500, Penthouse $2,500; Studio has no monthly rate. Address: Militia Street, Mango Link, Tema, Community 20. Fully / semi-furnished. Per-type galleries as listed in the photo inventory (memory `redesign-direction`).
- Palette navy / champagne / ivory / sand; Playfair Display + Inter. `DESIGN.md` and the `gagrafa-frontend-design` skill apply.

### 7.2 Booking rules

- **Availability** is per type: a type is available for a stay when at least one of its rooms is free for every night (no live booking, no blocked dates, no Airbnb reservation on that room).
- **Pencilling in:** on booking, the server picks a free room of the type and stores it on the booking with `room_confirmed = false`. Choice rule (builder's call): lowest room number that is free, so rooms fill predictably. If the insert hits the overlap guard (a race), try the next free room; if none is left, return the normal "dates just taken" error.
- **Down payment for every stay:** the guest chooses down payment (percent from Settings, default 50) or full. The current "only 7+ days before check-in" rule is removed. 0 in Settings turns the option off. The server re-checks as today.
- **Monthly rate** applies automatically to stays of 30 nights or more (rule in 8.1).
- **Cancellation** (owner confirmed 2026-10-29): cancelled more than 72 hours before check-in: full refund of what was paid. Within 72 hours (or a no-show): one night is charged; the rest of what was paid is refunded. Replaces the 100/50/0 tiers in `src/lib/booking/cancellation-policy.ts`, the FAQ and Terms. Only admins refund (unchanged).
- **Balance due** (my call): by arrival. The arrival reminder email (existing daily cron) includes a "Pay balance" link; staff can also send the link, or record cash / MoMo / bank as today.
- The export to Airbnb includes confirmed or part-paid bookings and blocked dates, not unpaid 30-minute holds (my call).
- Existing limits stay: 365 nights max, 2 years ahead, guests ≤ the type's max.

### 7.3 Admin (mockups approved, `admin-today-and-portal-v3.html`)

Menu: **Today · Bookings · Guests · Inbox · Apartments · Money · Settings**. Money and Settings are admin-only (as today's Reports / Payments / Settings / Team / Promo Codes / Audit Log are).

- **Today:** date and greeting; four numbers (arriving today, leaving today, occupied tonight "x of 13", balances owed); **Needs attention** (rooms to confirm, Airbnb clashes, payments needing review, paid after cancellation, cancellation requests, payment mismatches); arriving and leaving lists with tags (owes $x / paid / Airbnb); 13 room tiles "Room 1 … Room 13" with type and status (occupied / needs cleaning / ready / free), tap to mark cleaned.
- **Room assignment:** "Room to assign: guest, type, dates. Pencilled in: Room 8" with Confirm and Change. Change lists only rooms of the same type that are free for the whole stay. Confirming does not email the guest (builder may add the room to the arrival reminder email).
- **Bookings:** list, calendar (13 rows, one per room, Airbnb reservations shown in a distinct colour), availability, new booking (staff pick type and optionally the room), block dates per room.
- **Guests:** guest records (stay history, returning-guest tag, staff notes, WhatsApp link), reviews.
- **Inbox:** service requests, cancellation requests and contact messages (`contact_messages` is stored today but has no admin page).
- **Apartments:** the five types (description, prices, monthly price, photos), the 13 rooms (number, door code, Airbnb links), date-based special prices and minimum nights, Tour photos.
- **Money (admin):** payments, refunds, balances owed, "send payment link", receipts, occupancy and revenue per type and per room, nightly vs monthly, CSV exports.
- **Settings (admin):** property details, check-in / check-out times (2 PM / 11 AM), down payment percent, USD rate, promo codes, team, audit log.

### 7.4 Guest portal (mockup approved)

Photo header with type, dates, guests and booking code; balance card with progress and **Pay balance** (Paystack, same confirmation path as bookings); quick buttons Directions, WhatsApp reception, Add to calendar (.ics), Receipt; Arrival (Your room, check-in 2 PM, check-out 11 AM, Wi-Fi and door code from the day before arrival, address); requests (breakfast, airport transfer, housekeeping or repair); the 72-hour rule and a cancel request link. "Your room" reads "Reception will assign it before you arrive" until staff confirm, then "Room 8". Door code and Wi-Fi need both the existing day-before rule **and** a confirmed room. "Nearby" is removed.

### 7.5 Airbnb sync

- Each room has an **export link** (private, unguessable token per room) that Airbnb reads: an `.ics` of that room's live bookings and blocked dates, **excluding** events that came from Airbnb (no echo).
- Each room stores one **import link** (the Airbnb listing's calendar URL). Imported **reservations** block that room; Airbnb's "not available" blocks are ignored (they include our own exported dates).
- Airbnb reservations show in the admin as "Airbnb booking" (Airbnb sends no guest name); staff can add a name and notes.
- A clash (an Airbnb reservation overlapping a website booking on the same room) goes to Needs attention; staff move one of the bookings.
- Admin → Apartments shows a step-by-step setup guide, each room's last sync time and a "Sync now" button.

## 8. How it's built (builder's notes; marked where it is my call)

### 8.1 Monthly rate (owner confirmed 2026-10-29)

A stay of **30 nights or more** is priced at the monthly rate per 30 nights, pro rata for extra nights (45 nights at $2,000/month = $3,000). Studio (no monthly rate) always uses the nightly rate.

### 8.2 Data model (my call)

- Keep `units` as the **apartment type** (public pages, slug, prices, photos, description, max guests) so public queries barely change. Add `monthly_price`.
- New `rooms`: `id`, `unit_id` (type), `number` (1–13, unique), `is_active`, `last_cleaned_at`, `ical_export_token` (unique, random), `airbnb_ical_url`, `airbnb_synced_at`, `airbnb_sync_error`.
- `bookings`: add `room_id` (references rooms) and `room_confirmed boolean default false`. Move the exclusion constraint `bookings_no_overlap` from `unit_id` to `room_id`. `unit_id` stays as the booked type.
- `blocked_dates`: add `room_id`; blocks become per room.
- `unit_access_codes` becomes per room (`room_access_codes`, service-role only, like today).
- New `external_reservations`: `room_id`, `source` ('airbnb'), `uid` (unique per room), `check_in`, `check_out`, `summary`, `guest_name`, `notes`, `last_seen_at`, `removed_at`. Kept apart from `bookings` because Airbnb sends no guest email or price and must not trip the bookings overlap guard; clashes are found by query.
- `is_unit_available()` is replaced by `is_room_available(room_id, …)` (bookings + blocked_dates + external_reservations) and `free_rooms_for_type(unit_id, check_in, check_out)`.
- Cleaning status derived, no cron: a room "needs cleaning" when a stay ended after `last_cleaned_at`; "occupied" from tonight's bookings.
- New `special_prices` (unit_id, start_date, end_date, nightly_price, min_nights), `guest_notes` (keyed by lower-cased email), `check_in_time` / `check_out_time` on `property_settings`.
- One new migration file, idempotent with a `-- ROLLBACK` block, PGlite-tested, added to `scripts/gen-db-types.mjs`; plus `supabase/reset-and-seed.sql` for the wipe (5 types with real prices, 13 rooms, settings). The owner runs both.

### 8.3 Payments

Balance payment reuses `confirmPaymentByReference`. Each balance attempt needs its own Paystack reference (today the booking code is the reference), so the builder extends the reference format (for example `<booking code>-B<n>`) and maps it back to the booking. The webhook, idempotency and "never revive cancelled bookings" rules must hold for balance payments too, with tests.

### 8.4 Sync trigger

Vercel Hobby cron runs at most daily. Proposed (my call): a free external scheduler calls a protected `/api/cron/airbnb-sync` (same `CRON_SECRET`) every 15 minutes; the daily Vercel cron also runs it as a fallback; "Sync now" in the admin. The booking action also refreshes the chosen type's rooms if their last sync is older than 15 minutes (short timeout; a failed refresh does not block the booking). The owner sets up the external scheduler, like the uptime monitor.

### 8.5 Build order (my call)

Each phase ends with the full gate (tsc, lint, tests, check:imports, build) and the owner's OK.

1. **Rooms and rules:** migration, reset-and-seed, pencilling in, down payment for every stay, monthly rate, 72-hour rule, tests. Little visible change, but everything after depends on it.
2. **Public site:** logo, homepage, apartment pages, booking panel, Tour / About / FAQ / Terms copy. The Vercel preview to show the manager.
3. **Admin:** new menu, Today, room assignment, calendar by room, Inbox, Guests, Apartments, Money, Settings.
4. **Guest portal:** new look, pay balance, receipt, calendar file, directions, WhatsApp, room display.
5. **Airbnb sync:** export and import, clash detection, setup guide.

## 9. Left to the builder

Component structure, exact copy beyond the owner's facts, animation details within `DESIGN.md`, how the Today page loads its data, test layout, and the CSV columns.

## 10. Still to collect from the owner (does not block the plan)

Room sizes and bed types per type; the full 2560 px photo shoot; house rules (no smoking, quiet hours, pets); the production domain.
