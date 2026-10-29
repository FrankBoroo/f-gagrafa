# Phase 1: Rooms and Booking Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guests book an apartment type and the server pencils in a free physical room (13 rooms, 5 types), with monthly rates, a down payment for every stay and the 72-hour cancellation rule.

**Architecture:** `units` stays the apartment **type** (public pages unchanged). A new `rooms` table holds the 13 physical rooms; `bookings.room_id` + `room_confirmed` record the pencilled-in room, and the double-booking exclusion constraint moves from `unit_id` to `room_id`. Availability is "at least one free room of the type"; inserts walk the free rooms in number order and fall through on the overlap error (23P01). Pricing and policy rules stay pure functions in `src/lib/booking/`.

**Tech Stack:** Next.js 15.5, TypeScript strict, Supabase Postgres (exclusion constraints via btree_gist), Vitest, PGlite for SQL tests.

**Spec:** `docs/superpowers/specs/2026-10-29-redesign-design.md` (sections 6.2, 7.2, 8.1, 8.2). This plan is phase 1 of the build order in 8.5; phases 2–5 get their own plans.

## Global Constraints

- Rooms (owner facts): Room 1 Studio; Rooms 3, 5, 7, 10 1-Bed Standard; Rooms 2, 8, 9, 11, 12 1-Bed Executive; Rooms 4, 6 2-Bed Executive; Room 13 Penthouse.
- Nightly prices (USD): Studio 100, 1-Bed Standard 170, 1-Bed Executive 200, 2-Bed Executive 250, Penthouse 300. Monthly (USD): 1-Bed Standard 1500, 1-Bed Executive 2000, 2-Bed Executive 2500, Penthouse 2500, Studio none. Max guests 2.
- Monthly rule: a stay of **30 nights or more** costs `monthly × nights / 30`, rounded to the cent; types with no monthly price always use nightly.
- Down payment: offered for every stay when Settings `deposit_percent` is 1–90; 0 turns it off. No minimum days before check-in.
- Cancellation: cancelled **more than 72 hours** before check-in (2 PM, Ghana = UTC) → full refund of what was paid. Within 72 hours, after check-in, or no-show → one night is kept, the rest is refunded, never below 0.
- Guests never see room numbers in Phase 1 (no UI shows `room_id` to guests).
- CLAUDE.md rules apply: env via `src/lib/env*.ts`, `isStaff()`/`isAdmin()` on staff actions, `formatMoney`/`formatDate` for display, `actions.ts` exports only async functions and types, `await createClient()`.
- Migrations: idempotent, end with a `-- ROLLBACK` block, added to the SQL file list, then `npm run db:types`. Never re-run `schema.sql`.
- Gate before any push: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run check:imports`, `npm run build`. The owner OKs each commit+push batch; commit locally per task on branch `redesign`.

## Review Focus

1. Two guests take the last free room of a type at the same moment: exactly one booking succeeds; the other gets "those dates were just taken" (Task 1 SQL test on the constraint, Task 5 `tryRoomsInOrder` test).
2. Back-to-back stays in one room (one checks out the day the next checks in) are allowed (Task 1 SQL test).
3. A room switched off (`is_active = false`) is never pencilled in (Task 1 SQL test).
4. Changing a booking's dates keeps its room when that room is still free, without clashing with itself (Task 1 SQL test with `p_exclude_booking_id`; Task 5 action test).
5. The 72-hour boundary and a guest who paid less than one night: refund is full exactly before the boundary, one night kept at the boundary, and never negative (Task 4 tests).

---

### Task 1: Rooms migration and SQL test harness

**Files:**
- Create: `supabase/migration-rooms.sql`
- Create: `supabase/sql-files.json` (ordered list, single source of truth)
- Create: `scripts/supabase-stub.sql` (the stub now inline in `scripts/gen-db-types.mjs:31-36`)
- Modify: `scripts/gen-db-types.mjs:18-36` (read both files instead of inline constants)
- Create: `src/test/pglite-db.ts`
- Test: `src/lib/booking/rooms-sql.test.ts`
- Regenerate: `src/types/database.ts`

**Interfaces:**
- Produces (SQL):
  - `units.monthly_price numeric(10,2)` (nullable).
  - `rooms (id uuid pk default gen_random_uuid(), unit_id uuid not null references units(id) on delete restrict, number int not null unique check (number > 0), is_active boolean not null default true, created_at timestamptz not null default now())`, RLS enabled, no policies (service role only, like `unit_access_codes`), index on `unit_id`.
  - `bookings.room_id uuid references rooms(id) on delete restrict` (nullable), `bookings.room_confirmed boolean not null default false`, index on `(room_id, check_in, check_out)`.
  - Constraint `bookings_no_room_overlap`: `exclude using gist (room_id with =, daterange(check_in, check_out) with &&) where (status <> 'cancelled' and status <> 'no_show' and room_id is not null)`. Drop `bookings_no_overlap` (it would block two bookings of one type).
  - Constraint `bookings_room_required check (room_id is not null or status in ('cancelled','no_show')) not valid` (new rows only).
  - `blocked_dates.room_id uuid references rooms(id) on delete cascade` (nullable; a row with null `room_id` blocks every room of its `unit_id`).
  - `is_room_available(p_room_id uuid, p_check_in date, p_check_out date, p_exclude_booking_id uuid default null) returns boolean`: same hold rule as `is_unit_available` (ignore unpaid pending older than 30 min), checks bookings on the room and blocks on the room or on its type with null `room_id`.
  - `free_rooms_for_type(p_unit_id uuid, p_check_in date, p_check_out date, p_exclude_booking_id uuid default null) returns table (id uuid, number int)`: active rooms of the type where `is_room_available`, ordered by `number`.
  - Both functions: `revoke all ... from public, anon, authenticated; grant execute ... to service_role`.
  - Keep `is_unit_available` untouched (the live app on `main` still calls it; rollback safety).
- Produces (TS): `createTestDatabase(extraSql?: string[]): Promise<PGlite>` in `src/test/pglite-db.ts` — boots PGlite with btree_gist, runs `scripts/supabase-stub.sql` then every file in `supabase/sql-files.json`, then `extraSql`.

- [ ] **Step 1: Move the file list and stub out of `gen-db-types.mjs`**

`supabase/sql-files.json` = the current nine names in order plus `"migration-rooms.sql"`. `gen-db-types.mjs` reads it with `JSON.parse(readFileSync(...))` and the stub with `readFileSync`. Create `migration-rooms.sql` as an empty comment-only file for now so the list loads.

- [ ] **Step 2: Write `src/test/pglite-db.ts` and the failing SQL tests**

```ts
// src/lib/booking/rooms-sql.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "@/test/pglite-db";

// Fixture: type A with rooms 1 and 2, room 3 inactive; type B with room 4.
// Helper `book(room, in, out, extra?)` inserts a bookings row (status confirmed, paid).

describe("rooms migration", () => {
  it("runs twice without error (idempotent)");                      // exec migration-rooms.sql again
  it("lets two bookings of one type overlap on different rooms");
  it("rejects two live bookings on one room for overlapping nights with 23P01");
  it("allows back-to-back stays in one room");                      // A: 1st→3rd, B: 3rd→5th
  it("ignores cancelled and no_show bookings in the overlap guard");
  it("refuses a new live booking without a room");                  // bookings_room_required
});

describe("free_rooms_for_type", () => {
  it("lists free active rooms in number order");                    // expect [1, 2], never 3
  it("drops a room with an overlapping live booking");
  it("ignores unpaid pending holds older than 30 minutes");
  it("drops a room blocked by its own blocked_dates row");
  it("drops every room of the type for a block with null room_id");
  it("excludes the given booking, so a booking does not clash with itself");
});
```

Each `it` asserts exact room numbers (e.g. `expect(rows.map((r) => r.number)).toEqual([2])`) or, for 23P01, `await expect(db.query(...)).rejects.toMatchObject({ code: "23P01" })`. Use `{ timeout: 30_000 }` on the describe blocks (PGlite boot).

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/lib/booking/rooms-sql.test.ts`
Expected: FAIL (`relation "rooms" does not exist`).

- [ ] **Step 4: Write `supabase/migration-rooms.sql`**

Header in the style of `migration-deposits.sql`. Use `create table if not exists`, `add column if not exists`, `drop constraint if exists` before each `add constraint`, `create or replace function`. ROLLBACK block: drop the two functions, the two constraints, re-add `bookings_no_overlap` as in `schema.sql:421-427`, drop the new columns and `rooms`; note "run only after rolling the app back; DATA LOSS: room assignments".

- [ ] **Step 5: Run the tests, regenerate types**

Run: `npx vitest run src/lib/booking/rooms-sql.test.ts` → PASS. Run: `npm run db:types` → `src/types/database.ts` now has `rooms`, `room_id`, `room_confirmed`, `monthly_price`, `free_rooms_for_type`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migration-rooms.sql supabase/sql-files.json scripts/ src/test/pglite-db.ts src/lib/booking/rooms-sql.test.ts src/types/database.ts
git commit -m "Rooms table, per-room overlap guard and free-room lookup"
```

---

### Task 2: Reset-and-seed script

**Files:**
- Create: `supabase/reset-and-seed.sql`
- Test: `src/lib/booking/seed-sql.test.ts`

**Interfaces:**
- Consumes: Task 1 schema, `createTestDatabase(extraSql)`.
- Produces: a database with the 5 types (slugs `studio`, `one-bed-standard`, `one-bed-executive`, `two-bed-executive`, `penthouse`; enum types `studio`, `1bed_standard`, `1bed_executive`, `2bed`, `penthouse`) and the 13 rooms from Global Constraints.

- [ ] **Step 1: Write the failing test**

```ts
it("seeds 13 rooms with the owner's room numbers", async () => {
  // rows of: select r.number, u.slug from rooms r join units u on u.id = r.unit_id order by r.number
  expect(rows.map((r) => [r.number, r.slug])).toEqual([
    [1, "studio"], [2, "one-bed-executive"], [3, "one-bed-standard"], [4, "two-bed-executive"],
    [5, "one-bed-standard"], [6, "two-bed-executive"], [7, "one-bed-standard"], [8, "one-bed-executive"],
    [9, "one-bed-executive"], [10, "one-bed-standard"], [11, "one-bed-executive"], [12, "one-bed-executive"],
    [13, "penthouse"],
  ]);
});
it("seeds the old-site prices", /* slug → [base_price_per_night, monthly_price]:
  studio [100, null], one-bed-standard [170, 1500], one-bed-executive [200, 2000],
  two-bed-executive [250, 2500], penthouse [300, 2500]; all max_guests 2 */);
it("empties bookings and payments but keeps profiles, property_settings and gallery_items");
it("sets property_settings to USD pricing with deposit_percent 50");
it("can be run twice");
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/lib/booking/seed-sql.test.ts` → FAIL (file missing).

- [ ] **Step 3: Write `supabase/reset-and-seed.sql`**

First line comment: `-- DELETES ALL BOOKINGS, PAYMENTS, UNITS AND ROOMS. Run once, by hand, when wiping the database before launch.` Then `truncate payments, service_requests, reviews, bookings, blocked_dates, unit_access_codes, contact_messages, audit_log, portal_access_attempts, rate_limit_hits, promo_codes, rooms, units restart identity cascade;`, insert the 5 units (`description` and `images` left empty for Phase 2; `bedrooms`: studio 1, 1-beds 1, 2-bed 2, penthouse 1 with a `-- owner to confirm` comment), insert rooms by joining on slug, `update property_settings set price_currency = 'USD', deposit_percent = 50`.

- [ ] **Step 4: Run to verify it passes** — same command → PASS.

- [ ] **Step 5: Commit** — `git add supabase/reset-and-seed.sql src/lib/booking/seed-sql.test.ts && git commit -m "Reset-and-seed script with the 13 rooms and old-site prices"`

---

### Task 3: Monthly rate

**Files:**
- Create: `src/lib/booking/stay-price.ts`
- Test: `src/lib/booking/stay-price.test.ts`
- Modify: `src/lib/validations.ts:35-60` (`unitUpdateSchema`, `unitDetailsSchema`: `monthly_price: z.coerce.number().positive().nullable().optional()`, empty input → null)
- Modify: `src/components/admin/UnitForm.tsx`, `src/components/admin/UnitEditCard.tsx`, `src/app/admin/units/actions.ts` (edit and save "Monthly price", blank = none)
- Modify price maths in: `src/app/booking/actions.ts:133`, `src/app/admin/bookings/actions.ts:93`, `src/components/site/BookingFlow.tsx:63`, `src/components/site/BookingWidget.tsx:33,89`, `src/components/site/UnitPicker.tsx:216`, `src/components/admin/ManualBookingForm.tsx:31` (and widen the `select(...)` lists to include `monthly_price`)

**Interfaces:**
- Produces: `MONTHLY_MIN_NIGHTS = 30`; `stayPrice(nights: number, rates: { nightly: number; monthly: number | null }): number`; `usesMonthlyRate(nights: number, monthly: number | null): boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
expect(stayPrice(3, { nightly: 200, monthly: 2000 })).toBe(600);
expect(stayPrice(29, { nightly: 200, monthly: 2000 })).toBe(5800);
expect(stayPrice(30, { nightly: 200, monthly: 2000 })).toBe(2000);
expect(stayPrice(45, { nightly: 200, monthly: 2000 })).toBe(3000);
expect(stayPrice(31, { nightly: 170, monthly: 1500 })).toBe(1550);
expect(stayPrice(40, { nightly: 100, monthly: null })).toBe(4000);   // Studio
expect(stayPrice(30, { nightly: 100, monthly: 0 })).toBe(3000);      // 0 = no monthly price
expect(usesMonthlyRate(30, 2000)).toBe(true);
expect(usesMonthlyRate(29, 2000)).toBe(false);
```

- [ ] **Step 2: Run** — `npx vitest run src/lib/booking/stay-price.test.ts` → FAIL.
- [ ] **Step 3: Implement `stay-price.ts`** (pure, no server imports; round with `Math.round(x * 100) / 100`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Replace every `nights * base_price_per_night`** in the files listed with `stayPrice(nights, { nightly: Number(unit.base_price_per_night), monthly: unit.monthly_price === null ? null : Number(unit.monthly_price) })`. Where a line shows "$x × n nights", show "Monthly rate" instead when `usesMonthlyRate`. Check: `grep -rn "nights \* " src --include=*.ts --include=*.tsx` returns nothing outside tests.
- [ ] **Step 6: Run** — `npx tsc --noEmit && npm test` → both pass.
- [ ] **Step 7: Commit** — `git commit -am "Monthly rate for stays of 30 nights or more"` (plus the new files).

---

### Task 4: Down payment for every stay, 72-hour cancellation rule

**Files:**
- Modify: `src/lib/booking/deposit.ts`, `src/lib/booking/deposit.test.ts`
- Modify: `src/lib/booking/cancellation-policy.ts`, `src/lib/booking/cancellation-policy.test.ts`
- Modify callers: `src/app/booking/actions.ts:176`, `src/components/site/BookingFlow.tsx:73`, `src/app/portal/[code]/page.tsx:6,81,182`, `src/app/terms/page.tsx:1,36,45-55`, `src/components/admin/BookingDialogs.tsx:11,174,219`, `src/app/faq/page.tsx:10,26`

**Interfaces:**
- Produces (deposit.ts): `canOfferDeposit(percent: number): boolean` (true for 1–90). `DEPOSIT_MIN_DAYS_BEFORE_CHECKIN` is deleted. `depositAmount` unchanged.
- Produces (cancellation-policy.ts): `FREE_CANCELLATION_HOURS = 72`; `CHECK_IN_HOUR_UTC = 14`; `isFreeCancellation(checkIn: string, now?: Date): boolean` (true when `now` is more than 72 h before `checkIn` 14:00 UTC); `oneNightCharge(booking: { total_amount: number; nights: number }): number` (`total_amount / nights`, rounded to the pesewa); `suggestedRefund(amountPaid: number, booking: { check_in: string; total_amount: number; nights: number }, now?: Date): number`; `CANCELLATION_POLICY: string[]` (the two lines below). `daysUntilCheckIn` stays (other code uses it). `REFUND_TIERS`, `refundPercentFor` are deleted.

- [ ] **Step 1: Write the failing tests**

```ts
// deposit
expect(canOfferDeposit(50)).toBe(true);
expect(canOfferDeposit(90)).toBe(true);
expect(canOfferDeposit(0)).toBe(false);
expect(canOfferDeposit(95)).toBe(false);
// cancellation: check-in 2026-11-10 → 14:00 UTC; boundary = 2026-11-07T14:00:00Z
const b = { check_in: "2026-11-10", total_amount: 800, nights: 4 };
expect(isFreeCancellation("2026-11-10", new Date("2026-11-07T13:59:59Z"))).toBe(true);
expect(isFreeCancellation("2026-11-10", new Date("2026-11-07T14:00:00Z"))).toBe(false);
expect(suggestedRefund(400, b, new Date("2026-11-01T09:00:00Z"))).toBe(400);
expect(suggestedRefund(400, b, new Date("2026-11-08T09:00:00Z"))).toBe(200);   // one night = 200
expect(suggestedRefund(150, b, new Date("2026-11-08T09:00:00Z"))).toBe(0);     // never negative
expect(suggestedRefund(800, b, new Date("2026-11-12T09:00:00Z"))).toBe(600);   // after check-in
expect(oneNightCharge({ total_amount: 1000, nights: 3 })).toBe(333.33);
```

- [ ] **Step 2: Run** — `npx vitest run src/lib/booking/deposit.test.ts src/lib/booking/cancellation-policy.test.ts` → FAIL.
- [ ] **Step 3: Implement both modules.** `CANCELLATION_POLICY` copy, exactly:
  - "Cancel more than 72 hours before check-in (2 PM on your arrival day) for a full refund of what you've paid."
  - "Cancel within 72 hours of check-in, or don't arrive, and one night is charged; the rest of what you've paid is refunded."
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Update callers.** Server action: `canOfferDeposit(percent)`; error text "A down payment isn't available right now. Please pay in full." Portal and Terms render `CANCELLATION_POLICY` as a list; portal shows `suggestedRefund(paid, booking)` as the estimate. BookingDialogs uses the new `suggestedRefund` and shows "Full refund" or "One night kept" instead of a percent. FAQ cancellation answer = the two policy lines + the existing "Refunds are returned to the original payment method within 5–10 business days."; FAQ deposit answer: "Yes. You can choose to pay a down payment now (shown at checkout) to reserve your dates, and pay the rest before or on arrival. Refunds follow our cancellation policy and are based on the amount you've actually paid." Terms deposit sentence: drop "least 7 days away". Check: `grep -rn "7 days\|48 hours\|REFUND_TIERS\|refundPercentFor\|DEPOSIT_MIN_DAYS" src` returns nothing.
- [ ] **Step 6: Run** — `npx tsc --noEmit && npm test` → pass.
- [ ] **Step 7: Commit** — `git commit -am "Down payment for every stay; one night charged within 72 hours"`

---

### Task 5: Pencil in a room on every booking

**Files:**
- Create: `src/lib/booking/rooms.ts`
- Test: `src/lib/booking/rooms.test.ts`
- Modify: `src/lib/booking/availability.ts` (delete `isUnitAvailable`; keep `releaseStaleHolds`)
- Modify: `src/app/booking/actions.ts:38-63,117-125,186-235` (`checkUnitsAvailability`, `createBookingAndInitializePayment`)
- Modify: `src/app/admin/bookings/actions.ts:61-140,304-360` (`createManualBooking`, `updateBookingDates`)

**Interfaces:**
- Consumes: `free_rooms_for_type` (Task 1).
- Produces:
  - `freeRoomsForType(supabase: Db, stay: { unitId: string; checkIn: string; checkOut: string; excludeBookingId?: string }): Promise<{ id: string; number: number }[] | null>` (null = lookup failed).
  - `tryRoomsInOrder<T>(roomIds: string[], attempt: (roomId: string) => Promise<{ data: T | null; error: { code?: string } | null }>): Promise<{ data: T | null; error: { code?: string } | null; roomId: string | null }>` — tries each room; moves to the next only on `23P01`; any other error or success stops; with no rooms returns `{ data: null, error: { code: "23P01" }, roomId: null }`.

- [ ] **Step 1: Write the failing tests** (`rooms.test.ts`, fakes only, no database)

```ts
it("uses the first room when it is free");                    // roomId "r1", attempt called once
it("falls through to the next room on 23P01");                // r1 → 23P01, r2 → ok ⇒ roomId "r2"
it("stops on any other error");                              // r1 → { code: "23505" } ⇒ r2 never tried
it("reports 23P01 when every room was taken");               // all 23P01 ⇒ error.code "23P01", roomId null
it("reports 23P01 when there are no rooms");                 // [] ⇒ attempt never called
```

- [ ] **Step 2: Run** — `npx vitest run src/lib/booking/rooms.test.ts` → FAIL.
- [ ] **Step 3: Implement `rooms.ts`.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Wire it in.**
  - `checkUnitsAvailability`: a type is available when `freeRoomsForType(...)` returns at least one room (null → `true`, fail open as today).
  - `createBookingAndInitializePayment`: replace the `isUnitAvailable` check with `freeRoomsForType`; empty → the existing "not available for the selected dates" error; null → "We couldn't check availability. Please try again." The insert runs through `tryRoomsInOrder(rooms.map(r => r.id), roomId => insert({...row, room_id: roomId, room_confirmed: false}))`. Keep every existing error branch on the returned `error`.
  - `createManualBooking`: same pattern, `room_confirmed: false` (staff confirm rooms in Phase 3).
  - `updateBookingDates`: `freeRoomsForType({ ..., excludeBookingId: booking.id })`; if the current `room_id` is in the list keep it, else take the first and set `room_confirmed: false`; empty → existing "aren't available" error; record `room` in the audit `from`/`to`.
- [ ] **Step 6: Run** — `npx tsc --noEmit && npm test` → pass (tsc flags any remaining `isUnitAvailable` caller; `src/app/admin/availability/actions.ts` is fixed in Task 6, so do Task 6 before committing if tsc fails only there).
- [ ] **Step 7: Commit** — `git commit -am "Pencil in a free room of the booked type"` (plus new files).

---

### Task 6: Block dates per room

**Files:**
- Modify: `src/app/admin/availability/actions.ts`, `src/app/admin/availability/page.tsx`, `src/components/admin/BlockedDatesManager.tsx`
- Test: `src/app/admin/availability/actions.test.ts`

**Interfaces:**
- Consumes: `rooms` table; `is_room_available` (Task 1).
- Produces: `addBlockedDate(input: { room_id: string; start_date: string; end_date: string; reason?: string })` — staff only; looks up the room's `unit_id`, refuses if `is_room_available` is false ("This room has a booking on those dates."), inserts `{ room_id, unit_id, start_date, end_date, reason }`.

- [ ] **Step 1: Write the failing tests** (mock `isStaff`, `createServiceClient`, `logAudit` in the style of `src/lib/payments/booking-payment.test.ts`):

```ts
it("returns UNAUTHORIZED for non-staff");
it("refuses dates that clash with a booking on that room");     // rpc is_room_available → false
it("stores the room and its type");                             // insert payload has room_id and unit_id
```

- [ ] **Step 2: Run** — `npx vitest run src/app/admin/availability/actions.test.ts` → FAIL.
- [ ] **Step 3: Implement.** The page loads rooms joined to their type (`select("id, number, units(name)")`, ordered by number); the manager's picker lists "Room 3 · 1-Bed Standard"; each block row shows its room ("All 1-Bed Standard rooms" when `room_id` is null).
- [ ] **Step 4: Run** → PASS; `npx tsc --noEmit` → pass.
- [ ] **Step 5: Commit** — `git commit -am "Block dates per room"` (plus the test).

---

### Task 7: Late payment finds another free room

**Files:**
- Modify: `src/lib/payments/booking-payment.ts:116-145`
- Test: `src/lib/payments/booking-payment.test.ts`

**Interfaces:**
- Consumes: `free_rooms_for_type` via `supabase.rpc` (the test's existing `rpc` mock).

When confirming fails with `23P01` (the hold expired and someone took **that room**), call `free_rooms_for_type` for the booking's `unit_id` and dates; if a room is free, retry the confirm update once with `{ room_id, room_confirmed: false, status: "confirmed", ... }`. Only if no room is free (or the retry fails) fall into today's needs_review branch. The `cancelled_at` branch above stays first, so a booking a person cancelled is never revived.

- [ ] **Step 1: Write the failing tests**

```ts
it("confirms on another free room of the type when the held room was re-booked");
// firstUpdateError 23P01, rpc("free_rooms_for_type") → [{ id: "room-9", number: 9 }]
// ⇒ outcome "paid"; a bookings update with room_id "room-9", status "confirmed"
it("still goes to review when no room of the type is free");
// rpc → [] ⇒ outcome "needs_review", reason note contains "PAID AFTER HOLD EXPIRED"
it("never moves a booking that a person cancelled");
// booking.cancelled_at set ⇒ rpc never called, outcome "needs_review"
```

Extend the fake so a second `update` can succeed after the first fails.

- [ ] **Step 2: Run** — `npx vitest run src/lib/payments/booking-payment.test.ts` → the new tests FAIL, old ones pass.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → all PASS.
- [ ] **Step 5: Commit** — `git commit -am "Late payment: move to another free room of the type before flagging"`

---

### Task 8: Docs and full gate

**Files:**
- Modify: `CLAUDE.md` (Database list: add `10. supabase/migration-rooms.sql`, then `supabase/reset-and-seed.sql` only when wiping; Architecture notes: double-booking guard is per room (`bookings_no_room_overlap`), types vs rooms and pencilling in, deposits for every stay, 72-hour rule replacing the tiers)
- Modify: `LAUNCH.md` if it lists migrations (add the same two lines)

- [ ] **Step 1: Update the docs.**
- [ ] **Step 2: Run the gate** — `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run check:imports`, `npm run build` (on `Debug Failure ... .tsbuildinfo`, delete `.next/cache/.tsbuildinfo` and rebuild). Expected: all pass; test count higher than before the phase.
- [ ] **Step 3: Commit** — `git commit -am "Docs for rooms and the new booking rules"`
- [ ] **Step 4: Hand over to the owner:** the changed-file list, the two SQL files to run (migration first; reset-and-seed only when wiping), and ask for the OK to push the branch for a Vercel preview. Do not merge to `main`.
