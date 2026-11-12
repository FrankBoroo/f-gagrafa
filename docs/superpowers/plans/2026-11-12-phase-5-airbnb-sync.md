# Phase 5: Airbnb Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each of the 13 rooms exchanges calendars with its Airbnb listing: Airbnb reads our bookings from a private `.ics` link, and we import Airbnb reservations so the website can't sell the same room twice.

**Architecture:** One additive migration adds per-room export tokens and import URLs, an `external_reservations` table, and makes `is_room_available()` count live Airbnb reservations. Every availability path in the app already goes through `is_room_available` / `free_rooms_for_type` (online booking, staff booking, date changes, late payments, blocking dates), so that one SQL change protects all of them. Pure helpers in `src/lib/airbnb/` build the export, parse the import and find clashes; a sync module writes the results; a protected cron route, the daily cron, a "Sync now" button and a best-effort refresh in the booking action call it.

**Tech Stack:** Next.js 15 route handlers and server actions, Supabase (service client), PGlite tests, Vitest, `fetch` with `AbortSignal.timeout`.

**Spec:** `docs/superpowers/specs/2026-10-29-redesign-design.md` sections 7.5 (Airbnb sync), 8.2 (data model: `rooms.ical_export_token`, `airbnb_ical_url`, `airbnb_synced_at`, `airbnb_sync_error`; `external_reservations`), 8.4 (sync trigger). Skills: `gagrafa-supabase-migrations` (Task 1), `gagrafa-payments-booking` (Task 5, booking action), `gagrafa-frontend-design` / `ui-ux-pro-max` (Task 7).

## Builder's calls in this plan (owner to confirm when reviewing)

1. **What counts as an Airbnb reservation:** an imported event whose `SUMMARY` is `Reserved` (any case) or whose `DESCRIPTION` contains `/hosting/reservations/`. Everything else (Airbnb writes `Airbnb (Not available)` for blocks, which include the dates we export) is ignored. This matches Airbnb's feed format as I know it; **needs confirmation** against one real listing feed before go-live (Batch B gate).
2. **The export shows no guest details:** every event's summary is `Reserved` (bookings) or `Not available` (blocked dates). The link is secret, but a leaked link should not leak names.
3. **Exported events:** live bookings (same rule as `is_room_available`: not cancelled / no-show, unpaid holds count for 30 minutes) and blocked dates (the room's own and type-wide ones), with check-out from 30 days ago to 2 years ahead. All-day events (`VALUE=DATE`), check-out date exclusive, the format Airbnb uses.
4. **Import URL rule (blocks SSRF):** `https://` only, host `airbnb.<tld>` or `www.airbnb.<tld>` (e.g. `www.airbnb.com`, `www.airbnb.co.uk`), path starting `/calendar/ical/`. Fetch with `redirect: "error"`, 10 s timeout, body at most 1 MB.
5. **Removal rule:** a reservation that disappears from a *successfully parsed* feed gets `removed_at = now()` (cancelled on Airbnb), only if its check-out is today or later. Past ones drop off Airbnb's feed naturally and stay as history. A response without `BEGIN:VCALENDAR` is an error: nothing is changed or removed.
6. **Who does what:** admins set import URLs and see or replace export links (the link is a secret). Staff and admins can press "Sync now" and add a guest name or notes to an Airbnb booking.
7. **Today page:** Airbnb stays count for room status (occupied / needs cleaning) and appear in Arriving / Leaving labelled "Airbnb booking". They are not revenue and stay out of Money and Reports.
8. **Failure alert:** when a room's sync goes from OK to failing, the admin gets one `sendAdminSystemAlert` email; no repeat until it has recovered and failed again.

## Global Constraints

- Migration `supabase/migration-airbnb.sql`, idempotent, ends with `-- ROLLBACK`, added to `supabase/sql-files.json`, CLAUDE.md Database step 13 ("additive; run with the Phase 5 deploy"), `reset-and-seed.sql` truncate list, then `npm run db:types`.
- `external_reservations`: RLS on, no policies (service role only), like `room_access_codes`.
- Env through `src/lib/env.server.ts` (`serverEnv.CRON_SECRET`); the sync route fails closed without it, exactly like `src/app/api/cron/reminders/route.ts`.
- Dates are `YYYY-MM-DD` keys via `src/lib/booking/dates.ts`; dates shown to people via `formatDate` / `formatDateTime`.
- Every staff action calls `isStaff()` / `isAdmin()` and returns `UNAUTHORIZED`; `actions.ts` files export only async functions and types.
- Syncing is best-effort: a failed or slow sync never blocks or fails a booking.
- Full gate after each batch: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run check:imports`, and `npm run build` **in a scratch copy** while a dev server runs (it shares `.next`).

## Review Focus

1. Airbnb answers 200 with an HTML error or maintenance page: no rows are removed and the room shows the sync error (Task 4 test "non-calendar body").
2. A guest changes dates on Airbnb (same UID, new dates): the row is updated in place, not duplicated, and the old dates are free again (Task 4 test "moved reservation").
3. Our exported dates come back from Airbnb as "Not available": they are ignored, so a website booking never blocks itself or shows as a clash (Task 3 test "not available block").
4. An admin pastes an internal or look-alike URL (`http://169.254.169.254/…`, `https://airbnb.com.evil.io/calendar/ical/x.ics`): refused on save and refused again at fetch time (Task 4 tests on `airbnbCalendarUrlProblem`).
5. A website guest checks out the day an Airbnb guest checks in, on the same room: no clash and the room is bookable (Task 1 SQL test and Task 6 test "back to back").

---

## Batch A: data and export

### Task 1: Migration

**Files:**
- Create: `supabase/migration-airbnb.sql`, `src/lib/airbnb/airbnb-sql.test.ts`
- Modify: `supabase/sql-files.json`, `supabase/reset-and-seed.sql` (truncate list), `CLAUDE.md` (Database step 13, Architecture note), `src/types/database.ts` (generated)

**Interfaces:**
- Produces: `rooms.ical_export_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')` (64 hex chars, backfilled for existing rows by the default), `rooms.airbnb_ical_url text null check (char_length <= 500)`, `rooms.airbnb_synced_at timestamptz null`, `rooms.airbnb_sync_error text null`.
- Produces: table `external_reservations (id uuid pk, room_id uuid not null references rooms on delete cascade, source text not null default 'airbnb' check (source = 'airbnb'), uid text not null, check_in date not null, check_out date not null check (check_out > check_in), summary text, guest_name text check (<= 120), notes text check (<= 1000), last_seen_at timestamptz not null default now(), removed_at timestamptz null, created_at timestamptz default now(), unique (room_id, uid))`, index `(room_id, check_in, check_out) where removed_at is null`.
- Produces: `is_room_available()` with the same signature, plus `and not exists (select 1 from external_reservations e where e.room_id = p_room_id and e.removed_at is null and daterange(e.check_in, e.check_out) && daterange(p_check_in, p_check_out))`. Keep the existing revoke/grant lines.

- [ ] **Step 1: Write the failing PGlite tests** with `createTestDatabase()`: the migration runs twice; two new rooms get different 64-character tokens; a live external reservation 12-10 → 12-13 makes `is_room_available(room, '2026-12-11', '2026-12-12')` false and `free_rooms_for_type` skip that room; the same row with `removed_at` set makes it true; 12-13 → 12-15 is available (back to back); a second row with the same `(room_id, uid)` fails; deleting the room deletes its reservations.
- [ ] **Step 2: Run** `npx vitest run src/lib/airbnb/airbnb-sql.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the migration** and the file updates above, run `npm run db:types`. ROLLBACK block: drop the table, drop the four columns, restore the previous `is_room_available` body (copy from `migration-rooms.sql`).
- [ ] **Step 4: Run** `npx vitest run src/lib/airbnb src/lib/booking/seed-sql.test.ts src/lib/portal/portal-sql.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Airbnb migration: room calendar links, external reservations, availability counts them"`

### Task 2: Export calendar per room

**Files:**
- Create: `src/lib/ical/text.ts` (move `escapeText`, `fold`, `stamp` out of `src/lib/portal/ics.ts`, exported), `src/lib/airbnb/export.ts`, `src/lib/airbnb/export.test.ts`, `src/app/api/ical/[token]/route.ts`
- Modify: `src/lib/portal/ics.ts` (import from `@/lib/ical/text`), `src/lib/rate-limit.ts` (bucket `ical_export`: 120 per 15 min)

**Interfaces:**
- Produces: `roomExportIcs(input: { roomNumber: number; bookings: { id: string; check_in: string; check_out: string }[]; blocks: { id: string; start_date: string; end_date: string }[]; now: Date }): string`
- Produces: `GET /api/ical/<token>` (the room's `ical_export_token`, optional `.ics` suffix stripped): 200 `text/calendar; charset=utf-8`, `Cache-Control: no-store`; unknown token → 404 with an empty body; over the rate limit → 429.

- [ ] **Step 1: Write the failing tests** in `export.test.ts`: a booking 2026-12-10 → 12-13 gives `DTSTART;VALUE=DATE:20261210` and `DTEND;VALUE=DATE:20261213`, `SUMMARY:Reserved`, `UID:booking-<id>@thegagrafa`; a block gives `SUMMARY:Not available`, `UID:block-<id>@thegagrafa`; no guest name or email appears even when passed in extra fields; lines end `\r\n`; `X-WR-CALNAME:The Gagrafa Room 8`. Existing `src/lib/portal/ics.test.ts` still passes unchanged.
- [ ] **Step 2: Run** `npx vitest run src/lib/airbnb/export.test.ts src/lib/portal/ics.test.ts`. Expected: FAIL (export missing).
- [ ] **Step 3: Implement** the move, `roomExportIcs`, and the route. The route reads the room by token with the service client, then bookings by Builder's call 3 (status not cancelled / no_show, excluding pending + unpaid older than 30 minutes, check_out ≥ today − 30 days, check_in ≤ today + 2 years) and `blocked_dates` where `room_id = room` or (`room_id is null` and `unit_id = room.unit_id`). It never reads `external_reservations` (no echo).
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Private calendar link per room for Airbnb to read"`

### Batch A gate

- [ ] Full gate (Global Constraints). Expected: all pass.
- [ ] Ask the owner to run `supabase/migration-airbnb.sql` on the **preview** Supabase project and confirm. Do not push before that (the export route reads the new columns).
- [ ] `git push origin redesign`; on the preview, `curl` one room's link: 200, valid calendar with that room's test bookings, no names. A wrong token gives 404.

## Batch B: import and sync

### Task 3: Parse an Airbnb calendar

**Files:**
- Create: `src/lib/airbnb/parse.ts`, `src/lib/airbnb/parse.test.ts`, `src/lib/airbnb/fixtures/airbnb-sample.ics` (hand-written in Airbnb's format: one `Reserved` event with a `Reservation URL: https://www.airbnb.com/hosting/reservations/details/HM...` description, one `Airbnb (Not available)` event, folded lines)

**Interfaces:**
- Produces: `interface ImportedReservation { uid: string; checkIn: string; checkOut: string; summary: string }`
- Produces: `parseAirbnbIcs(text: string): { ok: true; reservations: ImportedReservation[] } | { ok: false; error: string }`

- [ ] **Step 1: Write the failing tests:** the fixture gives exactly one reservation with the right uid and `YYYY-MM-DD` dates; the "Not available" block is skipped ("not available block"); `DTSTART:20261210T000000Z` and `DTSTART;VALUE=DATE:20261210` both give `2026-12-10`; folded lines (CRLF + space) are joined; LF-only line endings work; an event without UID, or with check-out not after check-in, is skipped; text without `BEGIN:VCALENDAR` (e.g. `<html>…`) returns `{ ok: false }`; a valid calendar with no events returns `{ ok: true, reservations: [] }`.
- [ ] **Step 2: Run** `npx vitest run src/lib/airbnb/parse.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `parseAirbnbIcs` with Builder's call 1 as the reservation test. No library: unfold, split on `BEGIN:VEVENT` / `END:VEVENT`, read properties by name before `:` (ignoring parameters after `;`).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Read Airbnb calendar feeds"`

### Task 4: Sync a room

**Files:**
- Create: `src/lib/airbnb/url.ts`, `src/lib/airbnb/sync.ts`, `src/lib/airbnb/sync.test.ts` (fake query builder in the style of `src/lib/payments/balance-payment.test.ts`)

**Interfaces:**
- Consumes: `parseAirbnbIcs` (Task 3).
- Produces: `airbnbCalendarUrlProblem(url: string): string | null` (null = OK; sentence otherwise, Builder's call 4).
- Produces: `syncRoom(supabase: ServiceClient, room: { id: string; number: number; airbnb_ical_url: string | null; airbnb_sync_error: string | null }, opts: { fetchImpl?: typeof fetch; now: Date }): Promise<{ ok: true; added: number; updated: number; removed: number } | { ok: false; error: string }>`
- Produces: `syncRooms(supabase: ServiceClient, opts: { unitId?: string; olderThanMinutes?: number; timeoutMs?: number; now: Date }): Promise<{ synced: number; failed: number }>` (rooms with an import URL, optionally one type, optionally only those last synced longer ago than `olderThanMinutes`, in parallel; `timeoutMs` caps the whole call and returns what finished).

- [ ] **Step 1: Write the failing tests.** URL: OK for `https://www.airbnb.com/calendar/ical/123.ics?s=abc` and `https://airbnb.co.uk/calendar/ical/1.ics`; refused for `http://www.airbnb.com/calendar/ical/1.ics`, `https://airbnb.com.evil.io/calendar/ical/1.ics`, `https://www.airbnb.com/rooms/1`, `http://169.254.169.254/`, and a string over 500 characters. Sync (fetch mocked): new reservation inserted with `last_seen_at`; "moved reservation": same uid with new dates updates that row, no insert; a future row missing from the feed gets `removed_at`; a past row missing from the feed is untouched; a previously removed uid that reappears gets `removed_at: null`; "non-calendar body": HTML with status 200 writes only `airbnb_sync_error` and no reservation rows; fetch throwing (timeout) is the same; status 404 is the same; success sets `airbnb_synced_at` and clears `airbnb_sync_error`; a URL failing `airbnbCalendarUrlProblem` is refused without calling fetch; failure on a room whose `airbnb_sync_error` was null calls the `sendAdminSystemAlert` mock once, and a second failure does not.
- [ ] **Step 2: Run** `npx vitest run src/lib/airbnb/sync.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both files. Fetch with `redirect: "error"`, `signal: AbortSignal.timeout(10_000)`, read the body as text and refuse more than 1,000,000 characters. Store errors as short sentences (no stack). Log with `log.error("airbnb.sync_failed", { room: number }, err)`. Never log the import URL (it carries Airbnb's secret).
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Sync Airbnb reservations per room"`

### Task 5: When syncing runs

**Files:**
- Create: `src/app/api/cron/airbnb-sync/route.ts`, `src/app/api/cron/airbnb-sync/route.test.ts`
- Modify: `src/app/api/cron/reminders/route.ts` (call `syncRooms` first, `olderThanMinutes: 0`), `src/app/booking/actions.ts` (`createBookingAndInitializePayment`: before `freeRoomsForType`, `await syncRooms(supabase, { unitId, olderThanMinutes: 15, timeoutMs: 3000, now })` inside try/catch), `LAUNCH.md` (new step: external scheduler)

**Interfaces:**
- Consumes: `syncRooms` (Task 4).
- Produces: `GET /api/cron/airbnb-sync` with `Authorization: Bearer <CRON_SECRET>` → `200 { synced, failed }`; no secret configured → 500; wrong header → 401.

- [ ] **Step 1: Write the failing tests:** the route's 500 / 401 / 200 cases with `syncRooms` mocked; in the existing booking action tests, a `syncRooms` that throws or never resolves within 3 s still lets the booking proceed (mock and assert the insert happens).
- [ ] **Step 2: Run** `npx vitest run src/app/api/cron src/app/booking`. Expected: FAIL.
- [ ] **Step 3: Implement** the route (copy the auth block from the reminders route) and the two calls. LAUNCH.md: "Set up a free scheduler (for example cron-job.org) to call `https://<domain>/api/cron/airbnb-sync` every 15 minutes with header `Authorization: Bearer <CRON_SECRET>`; the daily Vercel cron is only the fallback."
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Airbnb sync: every 15 minutes, daily fallback, refresh before a booking"`

### Batch B gate

- [ ] Full gate. Push. On the preview: as admin, put a real Airbnb listing's export URL on one test room (owner supplies it), press nothing yet, call the sync route with the secret via `curl`. Check: reservations appear in `external_reservations` with the right dates, "Not available" blocks do not, and the booking page refuses that room's type only when every room of the type is taken. **Confirm Builder's call 1 against this real feed** and adjust the parser test fixture if Airbnb's format differs.

## Batch C: admin

### Task 6: Clashes, Today and the calendar

**Files:**
- Create: `src/lib/airbnb/clashes.ts`, `src/lib/airbnb/clashes.test.ts`
- Modify: `src/lib/admin/today.ts` (+ `today.test.ts`), `src/app/admin/page.tsx` (load live external reservations with check_out ≥ today − 1), `src/lib/admin/room-calendar.ts` (+ test), `src/app/admin/calendar/page.tsx`

**Interfaces:**
- Produces: `interface ExternalStay { id: string; room_id: string; check_in: string; check_out: string; guest_name: string | null }`
- Produces: `findClashes(external: ExternalStay[], bookings: { id: string; booking_code: string; guest_name: string; room_id: string | null; check_in: string; check_out: string; status: string; payment_status: string }[], today: string): { bookingId: string; bookingCode: string; externalId: string; detail: string }[]` (live bookings by `countsAsStay`, same room, half-open overlap, check_out ≥ today).
- Produces: `buildToday` input gains `external: ExternalStay[]`; `TodayView` gains `externalArriving: ExternalStay[]` and `externalLeaving: ExternalStay[]` (kept apart from `arriving` / `leaving`, whose rows carry money); `AttentionKind` gains `"airbnb_clash"` with title "Airbnb booking clash"; `CalendarSegment.kind` gains `"airbnb"` (label `guest_name ?? "Airbnb booking"`, `href: "/admin/bookings/airbnb"`).

- [ ] **Step 1: Write the failing tests:** overlap on the same room → one clash pointing at the website booking; "back to back" (website 12-10 → 12-13, Airbnb 12-13 → 12-15) → none; different rooms → none; a cancelled website booking → none; `buildToday` with an Airbnb stay 12-09 → 12-12 and today 12-10 marks the room occupied and is in neither `externalArriving` nor `externalLeaving`; with today 12-12 it is in `externalLeaving`; the room's status is `needs_cleaning` on 12-12 when `last_cleaned_at` is before it; the calendar row shows an `airbnb` segment.
- [ ] **Step 2: Run** `npx vitest run src/lib/airbnb/clashes.test.ts src/lib/admin`. Expected: FAIL.
- [ ] **Step 3: Implement.** The Today page shows `externalArriving` / `externalLeaving` under Arriving / Leaving as rows with `guest_name ?? "Airbnb booking"`, the room number and no money columns.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Airbnb bookings on Today and the calendar; clashes in Needs attention"`

### Task 7: Setup, links and Airbnb bookings list

**Files:**
- Create: `src/app/admin/bookings/airbnb/page.tsx`, `src/components/admin/AirbnbBookings.tsx`, `src/components/admin/AirbnbSetup.tsx`
- Modify: `src/app/admin/rooms/actions.ts` (+ `actions.test.ts`), `src/app/admin/rooms/page.tsx`, `src/components/admin/RoomsManager.tsx`, `src/lib/admin/nav.ts` (+ `nav.test.ts`: Bookings tab "Airbnb" → `/admin/bookings/airbnb`), `src/lib/validations.ts`

**Interfaces:**
- Consumes: `airbnbCalendarUrlProblem`, `syncRoom`, `syncRooms` (Task 4).
- Produces (in `src/app/admin/rooms/actions.ts`): `setRoomAirbnbUrl(input: { roomId: string; url: string })` (admin; empty string clears it and its error; otherwise validates, saves, then runs `syncRoom` and returns its result), `newRoomExportLink(roomId: string)` (admin; replaces the token, audit `room.export_link_replaced`), `syncAirbnbNow(roomId?: string)` (staff; one room or all), `updateAirbnbBooking(input: { id: string; guest_name: string; notes: string })` (staff; zod: name ≤ 120, notes ≤ 1000). All return `{ ok: true } | { ok: false; error: string }`; audit entries never include the URL or the token.

- [ ] **Step 1: Write the failing tests** for the four actions: `UNAUTHORIZED` for a guest (and for staff on the two admin ones); a bad URL is refused and nothing is saved; an empty URL clears `airbnb_ical_url` and `airbnb_sync_error`; `newRoomExportLink` writes a different 64-character token; the audit payloads contain no `url` or `token` key; `updateAirbnbBooking` refuses a 121-character name.
- [ ] **Step 2: Run** `npx vitest run src/app/admin/rooms src/lib/admin/nav.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Rooms tab (admins): a short guide (1. In Airbnb, open the listing → Availability → Connect calendars → Export, copy the link and paste it here. 2. In the same place, Import calendar: paste this room's link, name it "The Gagrafa". 3. Repeat for each room.), and per room: copy-able export link, "New link" (warns that Airbnb must be updated), import URL field, last sync (`formatDateTime`) or the error in red, "Sync now". Staff see last sync and "Sync now" only. Airbnb tab under Bookings: upcoming and current Airbnb bookings by check-in, room, dates, editable name and notes, removed ones hidden, a clash badge from `findClashes`.
- [ ] **Step 4: Run** `npm test`; then in a browser (isolated dev server, test admin login from memory) at desktop and 375 px: save a bad URL (refused), save the real preview listing URL from the Batch B gate, press Sync now, see the reservation on the Airbnb tab, add a name, see it on the calendar and Today; force a clash by creating a staff booking on that room via SQL test data and see it in Needs attention. Remove the test data afterwards. Expected: PASS, no console errors, no horizontal scroll.
- [ ] **Step 5: Commit** `git commit -m "Airbnb setup on Rooms, Airbnb bookings list with names and notes"`

### Batch C gate and push

- [ ] Full gate. Push; wait for the preview build.
- [ ] Owner checks on the preview: one room connected both ways with a real listing (Airbnb shows our test booking as blocked within its refresh time, which Airbnb controls and can take hours; our side shows the Airbnb reservation after Sync now). Report with phone-width screenshots and wait for the owner's look.
- [ ] Update `PLAN.md` / memory: Phase 5 shipped; remaining work is launch (`LAUNCH.md`), including the external scheduler.
