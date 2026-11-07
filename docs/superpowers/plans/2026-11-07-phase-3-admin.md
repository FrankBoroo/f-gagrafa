# Phase 3: Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 15-item admin with the approved 7-item admin (Today · Bookings · Guests · Inbox · Apartments · Money · Settings) so staff can run the building by room: confirm or change rooms, see today's arrivals, departures and cleaning, and handle requests, guests, special prices and money.

**Architecture:** Existing admin routes stay where they are and are grouped into 7 sections by one nav config (`src/lib/admin/nav.ts`); each section shows its pages as tabs. New pages (`/admin/inbox`, `/admin/rooms`, `/admin/special-prices`, `/admin/money`, `/admin/guests/[bookingId]`) follow the same pattern: a server page loads rows with the service client, a pure function in `src/lib/admin/` shapes them (that is what the tests cover), and thin components render. One idempotent migration adds the few columns and tables needed. Payment confirmation, holds, webhook and refund code are not touched.

**Tech Stack:** Next.js 15.5, TypeScript strict, Tailwind, Supabase, Vitest, PGlite. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-29-redesign-design.md` (sections 4, 5, 7.3, 8.2). Approved mockup: `.superpowers/brainstorm/1018-1793291728/content/admin-today-and-portal-v3.html` (admin Today half; local, gitignored). Use the `gagrafa-frontend-design` skill for the look and `gagrafa-supabase-migrations` for Task 1; Task 9 also needs `gagrafa-payments-booking`.

## Owner decisions for this phase (2026-11-07)

- One plan, built in two batches. Each batch ends with the full gate, a push of `redesign`, a Vercel preview check, and the owner's look. The owner OKed pushing each batch once its gate is green.
- The balance "send payment link" moves to Phase 4, together with the balance payment and the portal "Pay balance" button. Phase 3 shows balances owed and keeps "Record payment" (cash / MoMo / bank).

## Out of scope here (later phases)

- Phase 4: per-room door codes (`room_access_codes`), portal shows the room only when `room_confirmed`, balance payment and payment link, guest receipt in the portal (it reuses Task 10's receipt view).
- Phase 5: Airbnb links per room, Airbnb reservations in the calendar and Today lists, Airbnb clashes in Needs attention, sync status.

## Global Constraints

- Menu, in this order: **Today · Bookings · Guests · Inbox · Apartments · Money · Settings**. Money and Settings are admin-only; the rest are staff.
- Rooms are labelled "Room 1" … "Room 13". 13 rooms, 5 types: Room 1 Studio; 3, 5, 7, 10 1-Bed Standard; 2, 8, 9, 11, 12 1-Bed Executive; 4, 6 2-Bed Executive; 13 Penthouse. Counts come from the `rooms` table (active rooms), never a hard-coded 13.
- Admin copy says "apartment type" or "type" and "Room N"; replace "unit" / "residence" in any admin text a task touches.
- Check-in 2 PM, check-out 11 AM (Ghana, UTC+0). "Today" is `toISODate(new Date())`.
- Confirming or changing a room never emails the guest.
- Every staff action calls `isStaff()`, every admin action `isAdmin()`, and returns `UNAUTHORIZED` on failure. Admin-only pages re-check `isAdmin()` like `src/app/admin/payments/page.tsx`.
- The ledger stays in GHS (`total_amount`, `payments`). Money shown in admin uses `formatMoney(amount, booking.currency)`; never `toLocaleString` or `Intl`.
- No personal data in URLs: guest records are addressed by a booking id, never by email or phone.
- CLAUDE.md rules apply (env helpers, `actions.ts` exports only async functions and types, `startTransition` callbacks return void, explicit callback parameter types, best-effort messaging).
- Commit locally per task on `redesign`. Gate at the end of each batch: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run check:imports`, `npm run build`. Then push `redesign`. Nothing merges to `main` (Phase 4 must land first).
- Before pushing Batch A, the owner runs `supabase/migration-admin.sql` on the **preview** Supabase project. Never on the live database.

## Review Focus

1. Two people act on the same room at once (staff change a room while a guest books it): the loser gets "That room was just booked. Pick another." and nothing is half-saved (Task 3, 23P01 test).
2. Empty or unusual data: no bookings, a type with no rooms, fewer or more than 13 active rooms: Today, the calendar and Money render empty states and "x of N" from the real room count, never crash (Task 4 and Task 5 tests on empty input).
3. Special-price ranges at the edges of a stay: a range that starts on the check-out day is not charged; a range that covers only some nights prices only those nights; a 30+ night stay keeps the monthly rate (Task 9 tests).
4. Retiring things that have history: deactivating a room with upcoming bookings, deleting a room with any booking, deleting a type that still has rooms, are refused with a sentence that says what to do instead (Task 6 tests).
5. A staff user who types an admin URL or calls an admin action (Money, Settings, special prices, rooms): the page shows the admin-only message and the action returns `UNAUTHORIZED` (Task 2 nav test; `UNAUTHORIZED` tests in Tasks 6 and 9).

---

## Batch A: run the building

### Task 1: Migration for the admin

**Files:**
- Create: `supabase/migration-admin.sql`
- Create: `src/lib/admin/admin-sql.test.ts`
- Modify: `supabase/sql-files.json` (append `"migration-admin.sql"`), `supabase/reset-and-seed.sql` (add `special_prices, guest_notes` to the `truncate` list; header line "Run after supabase/migration-admin.sql"), `src/types/database.ts` (regenerated), `CLAUDE.md` (Database list: step 11 `supabase/migration-admin.sql`; reset-and-seed "right after step 11")

**Interfaces:**
- Produces (SQL): `rooms.last_cleaned_at timestamptz null`; `bookings.attention_cleared_at timestamptz null`; table `special_prices (id uuid pk default gen_random_uuid(), unit_id uuid not null references units(id) on delete cascade, start_date date not null, end_date date not null, nightly_price numeric(10,2) null, min_nights int null, label text null, created_at timestamptz not null default now())` with checks `end_date > start_date`, `nightly_price is null or nightly_price > 0`, `min_nights is null or min_nights between 1 and 365`, `nightly_price is not null or min_nights is not null`, and exclusion constraint `special_prices_no_overlap` `exclude using gist (unit_id with =, daterange(start_date, end_date) with &&)`; index `idx_special_prices_unit_dates (unit_id, start_date, end_date)`; table `guest_notes (email text primary key check (email = lower(email)), notes text not null default '' check (char_length(notes) <= 2000), updated_at timestamptz not null default now(), updated_by uuid null references profiles(id) on delete set null)`.
- RLS: enable on both tables. `special_prices`: one policy "special_prices: staff read" `for select using (is_staff())`; no write policies (writes go through the service role after `isAdmin()`). `guest_notes`: no policies (service role only).
- `end_date` is exclusive, like `blocked_dates` and bookings' `check_out`: a range 2026-12-24 → 2026-12-27 covers the nights of the 24th, 25th and 26th.

- [ ] **Step 1: Write the failing PGlite tests** in `src/lib/admin/admin-sql.test.ts`, using `createTestDatabase()` from `src/test/pglite-db.ts` and a seeded type (insert one `units` row):
  - `"special prices may not overlap on the same type"`: insert 2026-12-20 → 2026-12-27, then 2026-12-26 → 2026-12-30 for the same `unit_id`; the second rejects with code `23P01`. The same second range on another type succeeds.
  - `"touching special-price ranges are allowed"`: 2026-12-20 → 2026-12-27 then 2026-12-27 → 2027-01-02 both insert.
  - `"a special price needs a price or a minimum stay"`: both null rejects (`23514`); `end_date = start_date` rejects; `nightly_price = 0` rejects.
  - `"guest notes are keyed by lower-case email"`: inserting `email = 'Ama@Example.com'` rejects with `23514`; `'ama@example.com'` inserts.
  - `"the admin migration runs twice"`: `db.exec(readSupabaseFile("migration-admin.sql"))` a second time does not throw.
- [ ] **Step 2: Run** `npx vitest run src/lib/admin/admin-sql.test.ts`. Expected: FAIL (file `migration-admin.sql` not found).
- [ ] **Step 3: Write `supabase/migration-admin.sql`**: `if not exists` / `drop constraint if exists` / `drop policy if exists` throughout, as in `migration-rooms.sql`, ending with a commented `-- ROLLBACK` block that drops both tables, both columns and the index. Append it to `sql-files.json`, update the seed truncate list and CLAUDE.md, run `npm run db:types`.
- [ ] **Step 4: Run** `npx vitest run src/lib/admin/admin-sql.test.ts src/lib/booking/seed-sql.test.ts src/lib/booking/rooms-sql.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Admin migration: room cleaning time, attention flag, special prices, guest notes"`

### Task 2: Seven-section menu with tabs

**Files:**
- Create: `src/lib/admin/nav.ts`, `src/lib/admin/nav.test.ts`, `src/components/admin/SectionTabs.tsx`
- Modify: `src/components/admin/AdminNav.tsx`, `src/app/admin/layout.tsx`
- Modify: `src/app/admin/service-requests/page.tsx` (becomes `redirect("/admin/inbox")` in Task 7; leave it in the Inbox section map now)

**Interfaces:**
- Produces in `src/lib/admin/nav.ts`:
  - `type AdminSectionKey = "today" | "bookings" | "guests" | "inbox" | "apartments" | "money" | "settings"`
  - `interface AdminTab { href: string; label: string; adminOnly: boolean }`
  - `interface AdminSection { key: AdminSectionKey; label: string; href: string; adminOnly: boolean; tabs: AdminTab[] }`
  - `ADMIN_SECTIONS: AdminSection[]`, exactly:

| Section | href | admin only | Tabs (href → label) |
|---|---|---|---|
| Today | `/admin` | no | none |
| Bookings | `/admin/bookings` | no | `/admin/bookings` List · `/admin/calendar` Calendar · `/admin/availability` Blocked dates · `/admin/bookings/new` New booking |
| Guests | `/admin/guests` | no | `/admin/guests` Guests · `/admin/reviews` Reviews |
| Inbox | `/admin/inbox` | no | none (also owns `/admin/service-requests`) |
| Apartments | `/admin/units` | no | `/admin/units` Types · `/admin/rooms` Rooms · `/admin/special-prices` Special prices · `/admin/tour` Tour photos |
| Money | `/admin/money` | yes | `/admin/money` Overview · `/admin/payments` Payments · `/admin/reports` Reports |
| Settings | `/admin/settings` | yes | `/admin/settings` Property · `/admin/promo-codes` Promo codes · `/admin/team` Team · `/admin/audit-log` Audit log |

  - `sectionFor(pathname: string): AdminSection | null`: longest matching prefix over every section and tab href (a match is `pathname === href` or `pathname.startsWith(href + "/")`); `/admin` matches only exactly.
  - `visibleSections(role: string | null | undefined): AdminSection[]`: admin sees all; staff sees sections and tabs with `adminOnly: false`; anyone else sees none.
- Produces: `<SectionTabs role={role} />` (client; `usePathname`), rendered by the layout above `{children}`; nothing when the section has no tabs. Icons stay in `AdminNav.tsx` (map from `AdminSectionKey` to lucide icons: Today `Sun`, Bookings `CalendarDays`, Guests `Users`, Inbox `Inbox`, Apartments `Building2`, Money `Wallet`, Settings `Settings`).

- [ ] **Step 1: Write the failing tests** in `src/lib/admin/nav.test.ts`: `ADMIN_SECTIONS.map((s) => s.label)` equals `["Today","Bookings","Guests","Inbox","Apartments","Money","Settings"]`; `sectionFor("/admin")?.key === "today"`; `sectionFor("/admin/calendar")?.key === "bookings"`; `sectionFor("/admin/bookings/new")?.key === "bookings"`; `sectionFor("/admin/units/abc-123")?.key === "apartments"`; `sectionFor("/admin/service-requests")?.key === "inbox"`; `sectionFor("/admin/teamwork")` is `null`; `visibleSections("staff")` has no `money` or `settings`; `visibleSections("admin")` has 7; `visibleSections("guest")` and `visibleSections(undefined)` are `[]`; every href in the table is unique.
- [ ] **Step 2: Run** `npx vitest run src/lib/admin/nav.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `nav.ts`**, then rewrite `AdminNav.tsx` to render `visibleSections(role)` (active = `sectionFor(pathname)?.key`), and add `SectionTabs` to the layout. Keep the mobile menu behaviour `AdminNav` has today.
- [ ] **Step 4: Run** the nav tests, then `npm run dev` and open each of the 21 hrefs as an admin: every page still loads, the right section is highlighted, tabs show. Expected: PASS and no 404.
- [ ] **Step 5: Commit** `git commit -m "Admin menu: seven sections with tabs"`

### Task 3: Confirm or change a booking's room

**Files:**
- Create: `src/lib/booking/room-assignment.ts`, `src/lib/booking/room-assignment.test.ts`, `src/app/admin/bookings/room-actions.test.ts`, `src/components/admin/RoomAssignment.tsx`
- Modify: `src/app/admin/bookings/actions.ts`, `src/app/admin/bookings/page.tsx` (select `rooms(number)`), `src/components/admin/BookingCard.tsx`, `src/components/admin/ManualBookingForm.tsx`, `src/app/admin/bookings/new/page.tsx` (pass active rooms with `unit_id`, `number`)

**Interfaces:**
- Consumes: `freeRoomsForType`, `FreeRoom` from `src/lib/booking/rooms.ts`; `releaseStaleHolds`.
- Produces in `src/lib/booking/room-assignment.ts`:
  - `roomAssignmentError(booking: { status: string; payment_status: string }): string | null`: `"This booking is closed, so its room can't change."` for `cancelled`, `no_show`, `checked_out`; `"This booking is still waiting for payment."` for `pending` + `unpaid`; otherwise `null`.
  - `roomLabel(number: number | null | undefined): string`: `"Room 8"`, or `"No room"` for null/undefined.
- Produces in `src/app/admin/bookings/actions.ts` (all `isStaff()`):
  - `confirmRoom(bookingId: string): Promise<{ ok: boolean; error?: string }>`: sets `room_confirmed = true`; refuses when `roomAssignmentError` is not null or `room_id` is null. Audit `booking.room_confirmed` `{ booking_code, room_id }`.
  - `roomChoices(bookingId: string): Promise<{ ok: true; rooms: FreeRoom[]; currentRoomId: string | null } | { ok: false; error: string }>`: free rooms of the booking's type for its dates via `freeRoomsForType(..., excludeBookingId: booking.id)` after `releaseStaleHolds`.
  - `changeRoom(input: { bookingId: string; roomId: string }): Promise<{ ok: boolean; error?: string }>`: zod uuids; refuses per `roomAssignmentError`; refuses `"Room N isn't free for the whole stay."` when `roomId` is not in `roomChoices`; updates `room_id` and `room_confirmed = true` together; on `23P01` returns `"That room was just booked. Pick another."`. Audit `booking.room_changed` `{ booking_code, from, to }`.
  - `createManualBooking`: `manualBookingSchema` gains `room_id: z.string().uuid().optional()`. When given, it must be one of the free rooms of `unit_id` (`"That room isn't free for these dates."`), and the booking is inserted with that room and `room_confirmed: true`; when absent, behaviour is unchanged (pencil in the lowest free room).
- Produces: `<RoomAssignment booking={{ id, room_number, room_confirmed, status, payment_status }} />` (client): shows `roomLabel` plus "pencilled in" or "confirmed"; buttons **Confirm** (when pencilled in) and **Change** (loads `roomChoices`, a select of `roomLabel`s, Save calls `changeRoom`); toasts via sonner; `router.refresh()` after success. Used in `BookingCard` and in Task 4's Needs attention.

- [ ] **Step 1: Write the failing tests.** `room-assignment.test.ts`: the three `roomAssignmentError` messages and `null` for `confirmed`/`partial`, `checked_in`/`paid`, `pending`/`paid`; `roomLabel(8) === "Room 8"`, `roomLabel(null) === "No room"`. `room-actions.test.ts`, mocking like `src/app/admin/availability/actions.test.ts`: `changeRoom` returns `UNAUTHORIZED` when `isStaff` is false and writes nothing; refuses a room that is not in the free list; returns the "just booked" message when the update fails with `23P01`; on success the single update payload is `{ room_id: <id>, room_confirmed: true }`; `confirmRoom` refuses a cancelled booking; `createManualBooking` with a `room_id` that isn't free returns the error and inserts nothing.
- [ ] **Step 2: Run** `npx vitest run src/lib/booking/room-assignment.test.ts src/app/admin/bookings/room-actions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the helpers, the three actions, the manual-booking room option (form: a "Room" select listing the chosen type's active rooms plus "Any free room", default "Any free room"), and `RoomAssignment` on `BookingCard`.
- [ ] **Step 4: Run** the two test files and `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Staff confirm or change a booking's room"`

### Task 4: Today page

**Files:**
- Create: `src/lib/admin/today.ts`, `src/lib/admin/today.test.ts`, `src/app/admin/today/actions.ts`, `src/app/admin/today/actions.test.ts`, `src/components/admin/today/TodayNumbers.tsx`, `AttentionList.tsx`, `MovementList.tsx`, `RoomTiles.tsx` (same folder)
- Modify: `src/app/admin/page.tsx` (replaces the Overview)

**Interfaces:**
- Consumes: `RoomAssignment` (Task 3), `roomLabel`, `CANCELLATION_REQUEST_PREFIX` (Task 7 moves it; for now import the literal from a new export `CANCELLATION_REQUEST_PREFIX = "CANCELLATION REQUEST"` added to `src/lib/admin/today.ts` and re-exported by Task 7's `inbox.ts`).
- Produces in `src/lib/admin/today.ts`:
  - `interface TodayBooking { id: string; booking_code: string; guest_name: string; unit_name: string; room_id: string | null; room_number: number | null; room_confirmed: boolean; check_in: string; check_out: string; status: string; payment_status: string; total_amount: number; net_paid: number; currency: string; admin_notes: string | null; attention_cleared_at: string | null }`
  - `interface TodayRoom { id: string; number: number; unit_name: string; last_cleaned_at: string | null }` (active rooms only)
  - `type RoomStatus = "occupied" | "needs_cleaning" | "ready" | "free"`
  - `type AttentionKind = "room_to_confirm" | "payment_mismatch" | "paid_after_cancellation" | "payment_review" | "cancellation_request"`
  - `interface AttentionItem { kind: AttentionKind; bookingId: string; bookingCode: string; title: string; detail: string }`
  - `ATTENTION_MARKERS: { marker: string; kind: AttentionKind }[]` = `PAYMENT MISMATCH` → `payment_mismatch`; `PAID AFTER CANCELLATION` → `paid_after_cancellation`; `PAID AFTER HOLD EXPIRED` and `PAID BUT NOT CONFIRMED` → `payment_review` (the exact prefixes `src/lib/payments/booking-payment.ts` writes into `admin_notes`).
  - `countsAsStay(b: Pick<TodayBooking, "status" | "payment_status">): boolean`: status `confirmed`, `checked_in` or `checked_out`, or `pending` with payment not `unpaid`.
  - `balanceOwed(b: Pick<TodayBooking, "total_amount" | "net_paid">): number` = `max(total_amount - net_paid, 0)` rounded to 2 dp.
  - `roomStatus(room: TodayRoom, stays: TodayBooking[], today: string): RoomStatus`, where `stays` are that room's `countsAsStay` bookings. Rule, first match wins: **occupied** if a stay has `check_in < today < check_out`, or `status === "checked_in"` and `check_out > today`; **needs_cleaning** if it has a stay with `check_out <= today` and, for the latest such `check_out`, `last_cleaned_at` is null or earlier than `${check_out}T11:00:00Z`; **ready** if a stay has `check_in === today`; else **free**.
  - `buildToday(input: { today: string; bookings: TodayBooking[]; rooms: TodayRoom[]; cancellationRequests: { bookingId: string; bookingCode: string; createdAt: string }[] }): TodayView`, where `TodayView = { arriving: TodayBooking[]; leaving: TodayBooking[]; occupiedTonight: number; roomCount: number; balancesOwed: number; attention: AttentionItem[]; rooms: { room: TodayRoom; status: RoomStatus }[] }`. Arriving: `countsAsStay` and `check_in === today`. Leaving: `countsAsStay` and `check_out === today`. `occupiedTonight`: distinct `room_id`s with a stay where `check_in <= today < check_out`. `roomCount`: `rooms.length`. `balancesOwed`: sum of `balanceOwed` over stays with `check_out >= today` and status not `checked_out`. Attention, in this order: rooms to confirm (stay, `room_confirmed` false, `check_out >= today`), then any booking whose `admin_notes` contains a marker and `attention_cleared_at` is null (one item per booking, first marker found), then cancellation requests. Rooms sorted by number.
- Produces in `src/app/admin/today/actions.ts` (`isStaff()`): `markRoomCleaned(roomId: string)` sets `last_cleaned_at = now()`, audit `room.cleaned`; `clearAttention(bookingId: string)` sets `attention_cleared_at = now()`, audit `booking.attention_cleared`. Both `revalidatePath("/admin")`.
- Page data: (1) bookings with `check_out >= addDays(today, -30)` and status not in `(cancelled, no_show)`, selecting `units(name), rooms(number), payments(amount, status)`; (2) bookings with `attention_cleared_at is null` and `admin_notes` matching any marker (`.or()` of `admin_notes.ilike.%MARKER%`), any status; merge by id; (3) active rooms with `units(name)`; (4) `service_requests` with `status in (pending, in_progress)` and `description ilike 'CANCELLATION REQUEST%'`, joined to `bookings(booking_code)`. `net_paid` = sum of `success` and `refunded` payment rows, as in `src/app/admin/bookings/page.tsx`.

Layout follows the approved mockup: date and greeting ("Good morning" before 12:00 UTC, "Good afternoon" before 17:00, then "Good evening", with the staff member's first name from `getCurrentProfile()`); the four numbers (Arriving today, Leaving today, Occupied tonight "x of N", Balances owed `formatMoney(..., "GHS")`); Needs attention (empty state "Nothing needs you right now."); arriving and leaving lists with tags "owes GH₵x" or "paid"; room tiles "Room N", type, status, and a "Mark cleaned" button on `needs_cleaning` tiles (44 px target).

- [ ] **Step 1: Write the failing tests** in `today.test.ts` with fixtures on `today = "2026-12-10"`:
  - `"a room whose guest left today and wasn't cleaned needs cleaning"` (check_out 2026-12-10, `last_cleaned_at` null).
  - `"cleaning after 11 AM on the check-out day makes the room free"` (`last_cleaned_at = "2026-12-10T11:30:00Z"` → `free`; `"2026-12-10T10:00:00Z"` → `needs_cleaning`).
  - `"a clean room with an arrival today is ready"`; `"a staying guest makes the room occupied even if it was never cleaned"`.
  - `"an unpaid pending hold counts nowhere"` (not in arriving, not occupied, no attention item).
  - `"occupied tonight counts rooms, not bookings"` and `roomCount` equals the rooms passed in (pass 12 rooms → 12).
  - `"balances owed sums what's left on current and future stays"` (total 3480, net_paid 1740 → 1740; a fully paid one adds 0; a checked_out one is skipped).
  - `"a mismatch note shows until attention is cleared"`, `"paid after cancellation shows on a cancelled booking"`, `"a pencilled-in room shows as room to confirm"`, `"a cancellation request shows"`, and the attention order.
  - `"empty data renders an empty view"`: `buildToday({ today, bookings: [], rooms: [], cancellationRequests: [] })` gives zeros and empty arrays.
  - `actions.test.ts`: both actions return `UNAUTHORIZED` for non-staff and write nothing; `markRoomCleaned` updates only `last_cleaned_at`.
- [ ] **Step 2: Run** `npx vitest run src/lib/admin/today.test.ts src/app/admin/today/actions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `today.ts`, the actions, the four components, and the page. A "Mark handled" button on payment attention items calls `clearAttention`; room items render `RoomAssignment`; cancellation requests link to `/admin/inbox`.
- [ ] **Step 4: Run** the tests, then check `/admin` in the browser at desktop and 375 px width against the mockup. Expected: PASS; no horizontal scroll at 375 px.
- [ ] **Step 5: Commit** `git commit -m "Today page: numbers, needs attention, arrivals, departures, room tiles"`

### Task 5: Calendar with one row per room

**Files:**
- Create: `src/lib/admin/room-calendar.ts`, `src/lib/admin/room-calendar.test.ts`
- Modify: `src/app/admin/calendar/page.tsx`, `src/components/admin/BookingCalendar.tsx`

**Interfaces:**
- Produces in `src/lib/admin/room-calendar.ts`:
  - `interface CalendarSegment { kind: "booking" | "hold" | "block"; id: string; label: string; startDay: number; endDay: number; confirmed: boolean; href: string | null }`. Days are 1-based within the month; `endDay` is the last night shown (inclusive). `hold` = `pending` + `unpaid`. Booking label = guest name; block label = reason or "Blocked". `href` = `/admin/bookings?q=<booking_code>` for bookings and holds, null for blocks.
  - `interface RoomRow { roomId: string; label: string; unitName: string; segments: CalendarSegment[] }`
  - `roomCalendarRows(input: { year: number; month: number; rooms: { id: string; number: number; unit_id: string; unit_name: string }[]; bookings: { id: string; booking_code: string; guest_name: string; room_id: string | null; room_confirmed: boolean; check_in: string; check_out: string; status: string; payment_status: string }[]; blocks: { id: string; unit_id: string; room_id: string | null; start_date: string; end_date: string; reason: string | null }[] }): RoomRow[]`. Rows sorted by room number; a block with `room_id` null appears on every room of its `unit_id`; segments are clipped to the month; a stay's last night is `check_out - 1`.
- Page query: bookings with `room_id` not null, status not in `(cancelled, no_show)`, overlapping the month; active rooms with `units(name)`; blocks overlapping the month.
- Component: 13 (N) rows × days-in-month grid, room label sticky on the left, horizontal scroll inside the calendar only on small screens; booking segments navy (confirmed room) or navy outline (pencilled in), holds sand, blocks hatched grey; a legend; month navigation kept. Phase 5 adds an Airbnb colour.

- [ ] **Step 1: Write the failing tests**: a stay 2026-11-28 → 2026-12-03 in December gives `startDay 1, endDay 2`; a stay 2026-12-30 → 2027-01-04 gives `startDay 30, endDay 31`; a type-wide block shows on both rooms of a two-room type and not on another type; a pending unpaid booking has `kind "hold"`; rows come out in room-number order; empty rooms give an empty array.
- [ ] **Step 2: Run** `npx vitest run src/lib/admin/room-calendar.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the function, the page query, and the grid.
- [ ] **Step 4: Run** the tests; open `/admin/calendar` with the preview's test bookings. Expected: PASS; each booking sits on its room row.
- [ ] **Step 5: Commit** `git commit -m "Calendar shows one row per room"`

### Task 6: Rooms page, safe type deletion, currency-change warning

**Files:**
- Create: `src/app/admin/rooms/page.tsx`, `src/app/admin/rooms/actions.ts`, `src/app/admin/rooms/actions.test.ts`, `src/components/admin/RoomsManager.tsx`, `src/app/admin/settings/actions.test.ts`
- Modify: `src/app/admin/units/actions.ts` (`deleteUnit`), `src/app/admin/units/page.tsx` and `src/components/admin/UnitEditCard.tsx` (room count per type; "No rooms yet: guests can't book this type. Add rooms in Rooms." when 0), `src/app/admin/settings/actions.ts`, `src/components/admin/SettingsForm.tsx`, `CLAUDE.md` (Architecture notes: admin menu and where things live)

**Interfaces:**
- Produces in `src/app/admin/rooms/actions.ts` (all `isAdmin()`):
  - `createRoom(input: { number: number; unit_id: string }): Promise<{ ok: boolean; error?: string }>`: integer 1–999, unique (`23505` → `"Room N already exists."`). Audit `room.created`.
  - `setRoomActive(roomId: string, isActive: boolean)`: deactivating is refused when the room has bookings with `check_out >= today` and status not in `(cancelled, no_show)`: `"Room N has K upcoming booking(s). Move them to another room first."`. Audit `room.activated` / `room.deactivated`.
  - `deleteRoom(roomId: string)`: refused when any booking references the room: `"Room N has bookings on record, so it can't be deleted. Deactivate it instead."`. Audit `room.deleted`.
- `deleteUnit`: before the bookings check, refuse when the type has rooms: `"This type has N room(s). Delete or move them in Rooms first."`.
- Rooms page: table of rooms (Room N, type, active, last cleaned `formatDateTime` or "Not yet"); admins get Add room (number + type select), Activate/Deactivate, Delete; staff see the list read-only. A note: "Door codes per room come with the guest portal update; Airbnb links with the Airbnb sync."
- Settings: `settingsSchema` gains `confirm_currency_change: z.boolean().optional()`. `updatePropertySettings` reads the saved `price_currency`; when the new one differs and `confirm_currency_change !== true`, it returns `"Changing the price currency changes what every apartment price means. Tick the box to confirm, then re-enter every price."` and saves nothing. `SettingsForm` shows, as soon as the currency select differs from the saved value, a warning panel with that sentence and a required checkbox "I'll re-enter every apartment and promo price in {currency}". Settings also shows "Check-in 2 PM · Check-out 11 AM" as fixed text with the note "These times are part of the booking and cancellation rules. Ask your developer to change them." (builder's call: editable times would drift from the 72-hour rule in `src/lib/booking/cancellation-policy.ts` and the wording guests read).

- [ ] **Step 1: Write the failing tests.** `rooms/actions.test.ts`: each action returns `UNAUTHORIZED` for a staff user; `setRoomActive(id, false)` with one upcoming booking returns the "Move them" message and updates nothing; `deleteRoom` with a booking returns the "Deactivate it instead" message; `createRoom` maps `23505` to "already exists". `settings/actions.test.ts`: GHS → USD without the flag returns the confirm message and does not update; with `confirm_currency_change: true` it updates; saving with the same currency needs no flag. Add to the units tests (or a new `src/app/admin/units/actions.test.ts`): `deleteUnit` on a type with 2 rooms returns `"This type has 2 room(s). Delete or move them in Rooms first."`.
- [ ] **Step 2: Run** `npx vitest run src/app/admin/rooms src/app/admin/settings src/app/admin/units`. Expected: FAIL.
- [ ] **Step 3: Implement** the actions, the page, the room counts and warnings on Types, and the Settings warning.
- [ ] **Step 4: Run** those tests and `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Rooms page, safe type deletion, warning before changing the price currency"`

### Batch A gate and push

- [ ] Run `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run check:imports`, `npm run build`. Expected: all pass (on Windows, delete `.next/cache/.tsbuildinfo` if the build reports `Debug Failure`).
- [ ] Ask the owner to run `supabase/migration-admin.sql` on the **preview** Supabase project and confirm. Do not push before that: the new pages query its columns.
- [ ] `git push origin redesign`; wait for the Vercel preview to succeed (`gh api repos/FrankBoroo/f-gagrafa/commits/<sha>/status`).
- [ ] With the owner signed in to the preview admin: open Today, confirm the room on one of the test bookings, change another booking's room, mark a room cleaned, open the calendar. Report results and wait for the owner's look before Batch B.

---

## Batch B: business helpers

### Task 7: Inbox

**Files:**
- Create: `src/lib/admin/inbox.ts`, `src/lib/admin/inbox.test.ts`, `src/app/admin/inbox/page.tsx`, `src/app/admin/inbox/actions.ts`, `src/components/admin/InboxItemCard.tsx`
- Modify: `src/app/admin/service-requests/page.tsx` (→ `redirect("/admin/inbox")`), `src/app/portal/actions.ts` (use `CANCELLATION_REQUEST_PREFIX` instead of the literal), `src/lib/admin/today.ts` (import the prefix from `inbox.ts`)

**Interfaces:**
- Produces in `src/lib/admin/inbox.ts`:
  - `CANCELLATION_REQUEST_PREFIX = "CANCELLATION REQUEST"` (moved here from Task 4).
  - `type InboxKind = "cancellation_request" | "service_request" | "contact_message"`
  - `interface InboxItem { kind: InboxKind; id: string; createdAt: string; title: string; body: string; open: boolean; bookingCode: string | null; email: string | null; status: string }`
  - `buildInbox(input: { serviceRequests: { id: string; type: string; status: string; description: string | null; created_at: string; bookings: { booking_code: string; guest_name: string } | null }[]; contactMessages: { id: string; name: string; email: string; message: string; is_read: boolean; created_at: string }[]; filter: "open" | "all" }): InboxItem[]`. A service request whose description starts with the prefix is a `cancellation_request` (title "Cancellation request · <guest>", body = text after `": "` or "No reason given"); other requests: title "<Type> · <guest>" with the type in words (cleaning → Housekeeping, towels → Towels, maintenance → Repair, other → Request). Contact: title "Message from <name>". Open = service status `pending` or `in_progress`, contact `!is_read`. `filter: "open"` keeps open items only. Order: open first, then newest `createdAt` first.
- Produces in `src/app/admin/inbox/actions.ts` (`isStaff()`): `setContactMessageRead(id: string, isRead: boolean)`; audit `contact.read` / `contact.unread`. Service requests keep `updateServiceRequestStatus` from `src/app/admin/service-requests/actions.ts`.
- Page: tabs "Open" / "All" via `?show=all`; each card shows kind, time (`formatDateTime`), body (plain text, never HTML), and actions: cancellation request → "Open booking" (`/admin/bookings?q=<code>`, where Cancel & refund already lives) and status buttons; service request → status buttons; contact → "Reply by email" (`mailto:` link) and Mark read / unread.

- [ ] **Step 1: Write the failing tests** in `inbox.test.ts`: cancellation detection and body text; "No reason given" when the description is just the prefix; type words; open rules for both sources; `filter: "open"` drops completed requests and read messages; ordering (an open older item before a closed newer one).
- [ ] **Step 2: Run** `npx vitest run src/lib/admin/inbox.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the function, actions, page, card, the redirect, and the prefix import in portal and Today.
- [ ] **Step 4: Run** the tests and `npm test` (the portal tests must still pass). Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Inbox: cancellation requests, service requests and contact messages"`

### Task 8: Guest records and staff notes

**Files:**
- Create: `src/lib/admin/guests.ts`, `src/lib/admin/guests.test.ts`, `src/app/admin/guests/[bookingId]/page.tsx`, `src/app/admin/guests/actions.ts`, `src/app/admin/guests/actions.test.ts`, `src/components/admin/GuestNotesForm.tsx`
- Modify: `src/app/admin/guests/page.tsx` (use `groupGuests`; each row links to `/admin/guests/<latestBookingId>`), `src/lib/contact-links.ts` and `src/lib/contact-links.test.ts`, `src/lib/db-values.ts` and `src/lib/db-values.test.ts`

**Interfaces:**
- Produces in `src/lib/admin/guests.ts`:
  - `interface GuestSummary { key: string; guest_name: string; guest_email: string; guest_phone: string; latestBookingId: string; stays: number; bookings: number; totalPaid: number; currency: string; lastStay: string; isReturning: boolean }`
  - `groupGuests(rows: { id: string; guest_name: string; guest_email: string; guest_phone: string; check_in: string; status: string; currency: string; net_paid: number }[]): GuestSummary[]`: key = trimmed lower-case email; `stays` counts bookings with status not `cancelled`/`no_show`; `isReturning = stays >= 2`; `totalPaid` = sum of `net_paid`; name, phone and `latestBookingId` come from the latest `check_in`; sorted by `lastStay` descending.
- Produces: `whatsappHref(phone: string): string | null` in `contact-links.ts`, same digit rules as `telHref` but `https://wa.me/<digits>` (Ghana `0…` → `233…`). `likeExact(value: string): string` in `db-values.ts`: escapes `\`, `%`, `_` for an exact case-insensitive `ilike`.
- Produces in `src/app/admin/guests/actions.ts` (`isStaff()`): `saveGuestNotes(input: { bookingId: string; notes: string }): Promise<{ ok: boolean; error?: string }>`: zod `notes` max 2000; looks up the booking's email, upserts `guest_notes` on `lower(email)` with `updated_by` = current profile id. Audit `guest.notes_saved` with `{ booking_code }` only (never the notes text or email).
- Guest record page (`isStaff()` page check): from the booking id, load all bookings `.ilike("guest_email", likeExact(email))` with `units(name), rooms(number), payments(amount, status)`; show name, email (`mailto:`), phone (`tel:` and WhatsApp), "Returning guest" tag, stays table (code, type, Room N when confirmed, dates, status, paid / owed), total paid, the notes form, and the guest's published reviews if any. Unknown booking id → `notFound()`.

- [ ] **Step 1: Write the failing tests**: `groupGuests` merges `Ama@Example.com` and `ama@example.com `; a cancelled booking doesn't count as a stay; two real stays set `isReturning`; latest name wins; `whatsappHref("059 381 0182") === "https://wa.me/233593810182"`, `whatsappHref("+44 20 7946 0000") === "https://wa.me/442079460000"`, `whatsappHref("call us")` is null; `likeExact("a_b%c\\d")` is `"a\\_b\\%c\\\\d"`; `saveGuestNotes` returns `UNAUTHORIZED` for non-staff, rejects 2001 characters, and upserts the lower-cased email.
- [ ] **Step 2: Run** `npx vitest run src/lib/admin/guests.test.ts src/lib/contact-links.test.ts src/lib/db-values.test.ts src/app/admin/guests/actions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the helpers, the action, the record page and the notes form.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Guest records with stay history, returning tag, WhatsApp and staff notes"`

### Task 9: Special prices and minimum nights

Use the `gagrafa-payments-booking` skill: this changes what guests are charged.

**Files:**
- Create: `src/lib/booking/special-prices.ts`, `src/lib/booking/special-prices.test.ts`, `src/app/admin/special-prices/page.tsx`, `src/app/admin/special-prices/actions.ts`, `src/app/admin/special-prices/actions.test.ts`, `src/components/admin/SpecialPricesManager.tsx`
- Modify: `src/app/booking/actions.ts` (`checkUnitsAvailability`, `createBookingAndInitializePayment`), `src/app/admin/bookings/actions.ts` (`createManualBooking` price), `src/components/site/BookingWidget.tsx`, `src/components/site/BookingFlow.tsx`, `src/components/site/UnitPicker.tsx`, the pages that load units for them (`src/app/units/[slug]/page.tsx`, `src/app/booking/page.tsx`), and their tests

**Interfaces:**
- Produces in `src/lib/booking/special-prices.ts` (pure, client-safe):
  - `interface SpecialPrice { start_date: string; end_date: string; nightly_price: number | null; min_nights: number | null }`
  - `stayPriceForDates(input: { checkIn: string; checkOut: string; rates: Rates; specials: SpecialPrice[] }): number`: when `usesMonthlyRate(nights, rates.monthly)` the monthly price from `stayPrice` is returned unchanged (builder's call: a monthly stay keeps the monthly rate); otherwise each night `d` (from `checkIn` up to `checkOut - 1`) costs the `nightly_price` of the special covering `d` (`start_date <= d < end_date`) or the base nightly rate; sum rounded to 2 dp.
  - `requiredMinNights(checkIn: string, checkOut: string, specials: SpecialPrice[]): number | null`: the largest `min_nights` among specials that cover any night of the stay.
  - `minNightsError(nights: number, required: number | null): string | null`: `"These dates need a stay of at least N nights."` when `required` is set and `nights < required`.
- Online booking (`createBookingAndInitializePayment`): load specials for the unit (`end_date > check_in` and `start_date < check_out`), refuse with `minNightsError`, and price with `stayPriceForDates` (then promo, deposit and `toChargeAmount` exactly as today). `checkUnitsAvailability` treats a type as unavailable when `minNightsError` is not null and returns `minNights: Record<string, number | null>` so the panel can say why. Staff bookings use `stayPriceForDates` for the total but are not held to minimum nights (like the stay limits).
- Public pages load each unit's specials with `end_date >= today` (`units(..., special_prices(start_date, end_date, nightly_price, min_nights))`) and pass them down; `BookingWidget`, `BookingFlow` and `UnitPicker` price with `stayPriceForDates`, and the panel shows the min-nights sentence instead of "Not available" when that is the reason.
- Produces in `src/app/admin/special-prices/actions.ts` (all `isAdmin()`; staff can view the page): `createSpecialPrice(input: { unit_id: string; start_date: string; end_date: string; nightly_price: number | null; min_nights: number | null; label: string | null })` (zod: real dates, `end_date > start_date`, at least one of price or min nights, price > 0, min nights 1–365, label ≤ 80; `23P01` → `"This type already has a special price on some of these dates."`); `deleteSpecialPrice(id: string)`. Audit `special_price.created` / `special_price.deleted`. `revalidatePath` for `/admin/special-prices`, `/units`, `/units/[slug]` (layout), `/booking`.
- Admin page: list per type (dates via `formatDate`, "GH₵/$ price a night" in the Settings currency via `formatMoney`, "at least N nights", label), add form, delete. Prices are in the Settings currency, like unit prices.

- [ ] **Step 1: Write the failing tests** in `special-prices.test.ts` with base $170: 3 nights 2026-12-23 → 2026-12-26 and a special 2026-12-24 → 2026-12-27 at $250 → `170 + 250 + 250 = 670`; a special starting on the check-out day (2026-12-26 → 2026-12-30) is not charged → 510; no specials equals `stayPrice`; a 30-night stay with monthly $1,500 and a special inside → `1500`; `requiredMinNights` picks the largest of two covering ranges and ignores a range that starts on check-out day; `minNightsError(3, 5)` returns the sentence with 5, `minNightsError(5, 5)` and `minNightsError(2, null)` return null. Action tests: `UNAUTHORIZED` for staff, `23P01` message, both-null refused. Booking action test (extend the existing booking action tests): a stay shorter than the min nights is refused before any insert; the charged amount uses the special price.
- [ ] **Step 2: Run** `npx vitest run src/lib/booking/special-prices.test.ts src/app/admin/special-prices` and the booking action tests. Expected: FAIL.
- [ ] **Step 3: Implement** the pure functions, then the server checks, then the client components, then the admin page.
- [ ] **Step 4: Run** `npm test`. Expected: PASS, including the existing `payment-summary`, `stay-price` and booking-link tests unchanged.
- [ ] **Step 5: Commit** `git commit -m "Special prices and minimum stays by date"`

### Task 10: Money: balances, receipts, reports by type and room

**Files:**
- Create: `src/lib/admin/money.ts`, `src/lib/admin/money.test.ts`, `src/app/admin/money/page.tsx`, `src/app/admin/bookings/[id]/receipt/page.tsx`, `src/components/admin/Receipt.tsx`
- Modify: `src/app/admin/reports/page.tsx` (occupancy by room), `src/components/admin/BookingCard.tsx` ("Receipt" link), `CLAUDE.md` (admin menu notes, Money). The CSV exports already exist (`src/app/api/admin/export/bookings` and `.../payments`, admin-only); Money links to them.

**Interfaces:**
- Produces in `src/lib/admin/money.ts`:
  - `interface MoneyBooking { id: string; booking_code: string; guest_name: string; unit_id: string; unit_name: string; room_id: string | null; room_number: number | null; check_in: string; check_out: string; status: string; payment_status: string; total_amount: number; net_paid: number; currency: string }`
  - `balancesOwed(bookings: MoneyBooking[], today: string): (MoneyBooking & { owed: number })[]`: `countsAsStay` (from `today.ts`), status not `checked_out`, `owed = balanceOwed(b) > 0`; sorted by `check_in` ascending.
  - `occupancyByRoom(input: { rooms: { id: string; number: number; unit_name: string }[]; bookings: MoneyBooking[]; from: string; to: string }): { roomId: string; label: string; unitName: string; nightsBooked: number; nightsInRange: number; percent: number }[]`: nights in `[from, to)` covered by that room's stays; percent rounded to a whole number; `nightsInRange = calculateNights(from, to)`.
  - `revenueByType(bookings: MoneyBooking[]): { unitId: string; unitName: string; nightly: number; monthly: number; total: number }[]`: sums `net_paid` of stays; a stay of 30+ nights counts as monthly (`MONTHLY_MIN_NIGHTS`).
  - `occupancyPercent(roomsOccupied: number, roomCount: number): number` (0 when `roomCount` is 0); the Reports page uses it with active rooms, replacing the active-units count.
- Money overview (admin-only): four numbers for the selected month (received, refunded, balances owed, occupancy %), the balances owed list (guest, code, type, Room N, check-in, owed `formatMoney(owed, currency)`, link to the booking where "Record payment" lives), revenue by type (nightly / monthly / total), occupancy by room for the month, CSV links (bookings, payments).
- Receipt page `src/app/admin/bookings/[id]/receipt/page.tsx` (`isStaff()`): `<Receipt booking payments settings />` printable (print CSS hides admin chrome): property name, address, phones from Settings; booking code, guest, type, dates, nights, total, each payment (date `formatDateTime`, method, amount; refunds as negative lines), net paid, balance; "Room N" only when `room_confirmed`. `Receipt` takes plain props so Phase 4's portal can render it.
- [ ] **Step 1: Write the failing tests** in `money.test.ts`: `balancesOwed` skips paid, cancelled, unpaid holds and checked-out stays, and orders by check-in; `occupancyByRoom` for a 10-day range with a 4-night stay overlapping the range start by 2 nights → `nightsBooked` counts only nights in range; a room with nothing booked is 0%; `revenueByType` puts a 30-night stay under monthly and a 3-night stay under nightly; `occupancyPercent(3, 0) === 0`, `occupancyPercent(6, 13) === 46`.
- [ ] **Step 2: Run** `npx vitest run src/lib/admin/money.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the functions, the Money page, the receipt page and component, the Reports occupancy fix, and the Receipt link on `BookingCard`.
- [ ] **Step 4: Run** `npm test`; open `/admin/money` and a receipt in the browser, and print-preview the receipt. Expected: PASS; the receipt prints on one page without the admin menu.
- [ ] **Step 5: Commit** `git commit -m "Money page: balances owed, receipts, revenue and occupancy by type and room"`

### Batch B gate and push

- [ ] Run the full gate (as in Batch A). Expected: all pass.
- [ ] `git push origin redesign`; wait for the preview build to succeed.
- [ ] With the owner signed in to the preview admin: open Inbox (send one contact message and one portal cancellation request from a test booking first), a guest record (save a note), add a special price on a test type and check the public apartment panel's price and minimum-stay message, open Money and a receipt. Remove the test special price afterwards. Report results.
- [ ] Update memory `redesign-direction.md`: Phase 3 shipped, next is the Phase 4 plan.
