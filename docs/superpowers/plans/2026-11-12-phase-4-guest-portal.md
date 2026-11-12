# Phase 4: Guest Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give guests the approved portal (photo header, balance card with **Pay balance**, quick buttons, arrival details by room, requests, cancel request) and give staff per-room door codes and a "Send payment link" button.

**Architecture:** A balance payment is a `payments` row created as `pending` with its own Paystack reference `<booking code>-B<6 chars>`; `confirmPaymentByReference` hands those references to a new `confirmBalancePayment`, so the webhook and the portal return page share one idempotent path, as bookings do today. Door codes move from the type (`unit_access_codes`) to the room (`room_access_codes`) and show only for a confirmed room. The portal page is split into small server components under `src/components/portal/`; the rules they use (who may pay, when access shows, the calendar file) are pure functions with tests.

**Tech Stack:** Next.js 15.5, TypeScript strict, Tailwind, Supabase, Paystack, Resend, Vitest, PGlite. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-29-redesign-design.md` sections 7.2 ("Balance due"), 7.4, 8.3. Phase 3 plan "Out of scope" list: `docs/superpowers/plans/2026-11-07-phase-3-admin.md`. The approved mockup (`admin-today-and-portal-v3.html`) is no longer on disk; section 7.4 is the reference. Skills: `gagrafa-payments-booking` (Tasks 2, 3), `gagrafa-supabase-migrations` (Task 1), `gagrafa-frontend-design` (Tasks 5, 6).

## Builder's calls in this plan (owner to confirm when reviewing)

- The guest pays the **whole** remaining balance in one go (no part payments online). Staff still record cash / MoMo / bank for anything else.
- Pay balance is offered on confirmed, checked-in and checked-out stays that owe more than 0, never on unpaid holds, cancelled, no-show or refunded bookings.
- Staff (not only admins) can set door codes and send payment links, as staff can edit door codes today.
- "Send payment link" emails the guest their portal link (and WhatsApp if Twilio is set up). The link is the existing 60-day portal magic link; the balance card is at the top of the portal.
- The arrival reminder email adds the room ("Your room: Room 8") once staff have confirmed it.
- Requests offered in the portal: Breakfast, Airport transfer, Housekeeping, Repair, Something else. "More towels" is dropped from the form (old requests still display).

## Global Constraints

- Ledger stays in GHS: `total_amount`, `payments.amount` and Paystack charges are cedis. Balance owed = `total_amount − netPaid(payments)` (`src/lib/admin/guests.ts`), shown with `formatMoney(amount, booking.currency)`.
- Only `success` and `refunded` payment rows count as paid. A `pending` balance row counts for nothing until confirmed.
- Never revive a cancelled, no-show or refunded booking; never confirm a charge below what the row expected or in another currency. A person resolves those (admin note + `sendAdminPaymentConflictAlert`).
- Door code and Wi-Fi show only when: status `confirmed` or `checked_in`, today ≤ check-out, (today ≥ check-in − 1 day or `checked_in`), **and** `room_confirmed` with a room set. "Your room" reads "Reception will assign it before you arrive" until confirmed, then "Room N".
- Check-in 2 PM, check-out 11 AM (Ghana, UTC+0). "Today" is `toISODate(new Date())`.
- Every portal read or write re-checks `hasPortalAccess(booking_code)`. No email, phone or door code in any URL.
- Every staff action calls `isStaff()` and returns `UNAUTHORIZED` on failure.
- Emails and WhatsApp stay best-effort; a failed send never fails a payment or an action.
- CLAUDE.md rules apply (env helpers, `actions.ts` exports only async functions and types, `startTransition` callbacks return void, explicit callback parameter types, format helpers, no `toLocaleString` / `Intl`).
- Commit per task on `redesign`. Gate at the end of each batch: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run check:imports`, `npm run build`. Nothing merges to `main` until the owner signs off this phase.
- Before pushing Batch A, the owner runs `supabase/migration-portal-v2.sql` on the **preview** Supabase project. Never on the live database.

## Review Focus

1. A guest opens Pay balance in two tabs and pays both: the second confirmation records the money, keeps the booking `paid`, adds "OVERPAID" with the amount to refund to the admin notes and alerts the admin once (Task 3 test).
2. Staff cancel a booking while the guest has Paystack open for the balance: the payment is recorded, the booking stays cancelled, the admin is alerted once (Task 3 test).
3. A portal URL for booking A carrying a balance reference of booking B (`/portal/A?reference=B-Bxxxxxx`): nothing is confirmed or shown for B (Task 5 test on `returnReferenceFor`).
4. A booking whose room is changed or still pencilled in the day before arrival: no door code shows; after staff confirm Room 8 the Room 8 code shows, never the old room's (Task 2 tests on `accessState`).
5. A stay whose total went up after a date change (`payment_status` `paid` but owing again): Pay balance is offered for exactly the new difference; a rounding remainder below 0.005 shows no button (Task 3 tests on `balanceProblem`).

---

## Batch A: door codes and balance payments

### Task 1: Migration for the portal

**Files:**
- Create: `supabase/migration-portal-v2.sql`, `src/lib/portal/portal-sql.test.ts`
- Modify: `supabase/sql-files.json` (append), `supabase/reset-and-seed.sql` (add `room_access_codes` to the truncate list), `src/types/database.ts` (via `npm run db:types`), `CLAUDE.md` (Database step 12)

**Interfaces:**
- Produces table `room_access_codes (room_id uuid primary key references rooms(id) on delete cascade, access_code text not null check (char_length(access_code) between 1 and 40), updated_at timestamptz not null default now())`, RLS enabled, no policies (service role only, like `unit_access_codes`).
- Produces enum values `service_request_type`: `breakfast`, `airport_transfer` (`alter type … add value if not exists`).
- `unit_access_codes` stays (no longer read); the `-- ROLLBACK` block drops `room_access_codes` and notes the enum values stay (harmless: older code never writes them).

- [ ] **Step 1: Write the failing PGlite tests** in `portal-sql.test.ts` with `createTestDatabase()`: running the migration twice succeeds; a room's code inserts and reads back; a 41-character code fails the check; deleting the room deletes its code; a `service_requests` insert with type `airport_transfer` succeeds.
- [ ] **Step 2: Run** `npx vitest run src/lib/portal/portal-sql.test.ts`. Expected: FAIL (file not found).
- [ ] **Step 3: Write the migration**, append it to `sql-files.json`, update the seed truncate list and CLAUDE.md (step 12, "additive; run with the Phase 4 deploy"), run `npm run db:types`.
- [ ] **Step 4: Run** `npx vitest run src/lib/portal/portal-sql.test.ts src/lib/booking/seed-sql.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Portal migration: door codes per room, breakfast and airport transfer requests"`

### Task 2: Door codes per room

**Files:**
- Create: `src/lib/portal/access.ts`, `src/lib/portal/access.test.ts`
- Modify: `src/app/admin/rooms/actions.ts` + `actions.test.ts` (`setRoomDoorCode`), `src/app/admin/rooms/page.tsx` + `src/components/admin/RoomsManager.tsx` (door code column), `src/app/admin/units/actions.ts`, `src/app/admin/units/[id]/page.tsx`, `src/components/admin/UnitForm.tsx` (remove the type door code field), `src/app/portal/[code]/page.tsx` (read the room's code)

**Interfaces:**
- Produces in `src/lib/portal/access.ts` (pure):
  - `type AccessState = "show" | "pending" | "no_room" | "too_early" | "over"`
  - `accessState(b: { status: string; check_in: string; check_out: string; room_id: string | null; room_confirmed: boolean }, today: string): AccessState`: `over` when cancelled / no-show / checked-out or today > check-out; `pending` when status `pending`; `too_early` when not checked in and today < check-in − 1; `no_room` when the room isn't set or confirmed; else `show`.
  - `ACCESS_MESSAGES: Record<Exclude<AccessState, "show">, string>`: pending "Your door code, Wi-Fi and entry details appear here once your booking is confirmed."; too_early "Your door code, Wi-Fi and entry details will appear here from the day before check-in."; no_room "Reception will assign your room before you arrive. Your door code appears here once it's set."; over "Access details are only shown during your stay."
  - `roomText(b: { room_confirmed: boolean; room_number: number | null }): string`: `"Room 8"` (via `roomLabel`) or `"Reception will assign it before you arrive"`.
- Produces in `src/app/admin/rooms/actions.ts`: `setRoomDoorCode(input: { roomId: string; code: string }): Promise<{ ok: true } | { ok: false; error: string }>`: `isStaff()`; zod uuid, code trimmed ≤ 40; empty code deletes the row; upsert otherwise; audit `room.door_code_set` / `room.door_code_cleared` with the room number, **never the code**; `revalidatePath("/admin/rooms")`.
- Rooms page: a "Door code" column; staff and admins edit it inline (input + Save); the page's note drops "Door codes per room come with the guest portal update".

- [ ] **Step 1: Write the failing tests.** `access.test.ts` with today `2026-12-10`: confirmed stay 12-11 → 12-14 with room confirmed → `show`; same with `room_confirmed: false` → `no_room`; `room_id: null`, confirmed true → `no_room`; check-in 12-12 → `too_early`; `checked_in` with check-in 12-20 (early arrival) and confirmed room → `show`; check-out 12-09 → `over`; `cancelled` → `over`; `pending` → `pending`; `roomText` both cases. `rooms/actions.test.ts`: `setRoomDoorCode` returns `UNAUTHORIZED` for a guest; an empty code deletes and doesn't upsert; a 41-character code is refused; the audit payload has no `code` key.
- [ ] **Step 2: Run** `npx vitest run src/lib/portal/access.test.ts src/app/admin/rooms`. Expected: FAIL.
- [ ] **Step 3: Implement** `access.ts`, the action, the column, remove the type door code field, and switch the portal page to `accessState` + `room_access_codes` (select `rooms(number)` with the booking).
- [ ] **Step 4: Run** `npm test`. Expected: PASS (update any units action test that sent `access_code`).
- [ ] **Step 5: Commit** `git commit -m "Door codes per room; the portal shows them only for a confirmed room"`

### Task 3: Balance payments

Use the `gagrafa-payments-booking` skill.

**Files:**
- Create: `src/lib/payments/balance.ts`, `src/lib/payments/balance.test.ts`, `src/lib/payments/balance-payment.ts`, `src/lib/payments/balance-payment.test.ts`
- Modify: `src/lib/payments/booking-payment.ts` (delegate balance references), `src/lib/payments/booking-payment.test.ts`, `src/lib/rate-limit.ts` (bucket), `src/lib/notify/email.ts` (`sendBalanceReceivedEmail`), `src/app/portal/actions.ts` (`payBalance`), `CLAUDE.md` (Payments note)

**Interfaces:**
- Produces in `src/lib/payments/balance.ts` (pure):
  - `balanceReference(bookingCode: string, random?: () => string): string` → `"GAG-2026-AB12CD-B" + 6 characters` from `A-Z0-9` (default random uses `crypto.getRandomValues`).
  - `parseBalanceReference(reference: string): string | null`: the booking code for `^(GAG-\d{4}-[A-Z0-9]+)-B[A-Z0-9]{6}$`, else null.
  - `balanceProblem(b: { status: string; payment_status: string; total_amount: number }, netPaid: number): string | null`: null when status is `confirmed` / `checked_in` / `checked_out`, `payment_status` is not `refunded`, and owed > 0.005; otherwise `"There's nothing left to pay on this booking."` (owed ≤ 0.005) or `"This booking can't be paid online. Please contact us."`.
- Produces in `src/lib/payments/balance-payment.ts` (server-only):
  - `startBalancePayment(bookingCode: string): Promise<{ ok: true; url: string } | { ok: false; error: string }>`: loads booking + payments, refuses on `balanceProblem`, inserts `payments { booking_id, amount: owed, currency: booking.currency, method: "paystack", paystack_reference: balanceReference(code), status: "pending" }`, then `initializePaystackTransaction({ email: guest_email, amountInMajorUnits: owed, reference, currency: "GHS", callbackUrl: `${siteUrl()}/portal/${code}`, metadata: { booking_code, kind: "balance", cancel_action: `${siteUrl()}/portal/${code}` } })`. If Paystack fails, mark the row `failed`, log `balance.checkout_failed`, call `sendAdminSystemAlert`, and return "We couldn't start the payment. Please try again in a moment."
  - `confirmBalancePayment(reference: string): Promise<PaymentConfirmationResult>`: loads the payment row by `paystack_reference` with its booking (`not_found` when none). Row already `success` → `paid` (or `closed` for a cancelled/refunded booking), no side effects. Verify with Paystack; not `success` → `failed` (leave the row pending). Charged < row amount − 0.005 or currency ≠ booking currency → admin note `BALANCE PAYMENT MISMATCH …` + alert once, `failed`. Otherwise compare-and-set the row (`update … status success, amount charged, paid_at … where id = row.id and status = 'pending'`, `.select()`): no row back means another call won → return `paid` without notifying. Then recompute net paid: cancelled / no-show / refunded booking → admin note `PAID AFTER CANCELLATION (balance) …` + alert, `needs_review`, booking status untouched; net > total + 0.005 → `payment_status: "paid"`, note `OVERPAID: refund <formatMoney(net − total)>` + alert, `needs_review`; else `payment_status` `paid` or `partial`, `sendBalanceReceivedEmail(booking, unitName, charged, remaining)`, `paid`.
- `confirmPaymentByReference(reference)`: first line `if (parseBalanceReference(reference)) return confirmBalancePayment(reference);`. Its existing tests must pass unchanged.
- Rate limit bucket `balancePayment: { max: 10, windowSeconds: 60 * 60 }`.
- Produces in `src/app/portal/actions.ts`: `payBalance(bookingId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }>`: `isOverLimit("balancePayment")`, booking by id, `hasPortalAccess(booking_code)` ("Please verify your booking first."), then `startBalancePayment`.

- [ ] **Step 1: Write the failing tests.** `balance.test.ts`: `balanceReference("GAG-2026-AB12CD", () => "ZZ99ZZ") === "GAG-2026-AB12CD-BZZ99ZZ"`; parse round-trips; `parseBalanceReference("GAG-2026-AB12CD")` and `"GAG-2026-AB12CD-Bzz99zz"` are null; `balanceProblem` is null for confirmed/partial owing 500, for confirmed/**paid** with total 3000 and net 2500, and for confirmed/unpaid staff booking; nothing-left sentence at owed 0.004; can't-pay sentence for pending, cancelled, no_show and `refunded`. `balance-payment.test.ts` (fake query builder as in `booking-payment.test.ts`): start refuses a cancelled booking and inserts nothing; start inserts one pending row for the owed amount and returns Paystack's URL; Paystack failure marks the row failed and returns the sentence; confirm on an already-`success` row makes no writes and sends nothing; verify `abandoned` → `failed`, no writes; charged 400 for a 500 row → mismatch note once, `failed`; compare-and-set returning no row → `paid`, no email; partial → paid with email; cancelled booking → `needs_review`, status unchanged, one alert; second payment making net 1000 over total → `OVERPAID: refund` note, `needs_review`. `booking-payment.test.ts`: a `-B` reference is routed to `confirmBalancePayment` (mocked) and the bookings table is not read. Portal action test (new `src/app/portal/actions.test.ts` or extend the existing one): no portal access → error and `startBalancePayment` not called.
- [ ] **Step 2: Run** `npx vitest run src/lib/payments src/app/portal`. Expected: FAIL.
- [ ] **Step 3: Implement** in the order: `balance.ts`, `balance-payment.ts`, the delegation line, the rate-limit bucket, the email, `payBalance`. Add a CLAUDE.md Payments line: balance payments are `pending` payment rows with reference `<code>-B<6>`, confirmed by `confirmBalancePayment`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS, including the webhook and existing booking-payment tests.
- [ ] **Step 5: Commit** `git commit -m "Balance payments through Paystack, confirmed by the webhook and the portal"`

### Task 4: Payment link for staff, Pay balance in the arrival email

**Files:**
- Modify: `src/app/admin/bookings/actions.ts` (`sendPaymentLink`) + `room-actions.test.ts` or a new `payment-link.test.ts`, `src/components/admin/BookingCard.tsx` (button), `src/lib/notify/email.ts` (`sendBalancePaymentLinkEmail`, reminder copy), `src/lib/notify/whatsapp.ts` (`sendBalancePaymentLinkWhatsApp`), `src/app/api/cron/reminders/route.ts` (select `room_confirmed, rooms(number)`)

**Interfaces:**
- Consumes: `balanceProblem`, `netPaid`, `portalMagicLink`, `roomText`.
- Produces: `sendPaymentLink(bookingId: string): Promise<{ ok: true } | { ok: false; error: string }>`: `isStaff()`; refuse with `balanceProblem`'s sentence; send email + WhatsApp (best-effort); audit `booking.payment_link_sent` with the owed amount; returns ok even if a send failed (sends are best-effort; the toast says "Payment link sent to <email>").
- Email `sendBalancePaymentLinkEmail(booking, unitName, owed)`: subject `Your balance for <code>`; body owed amount, dates via `formatDate`, a "Pay balance" link to `portalMagicLink(code)`, and "or pay at reception by cash, bank transfer or Mobile Money".
- `sendPreArrivalReminder`: when `balanceDue > 0.005`, the same "Pay balance" link line replaces the front-desk-only sentence (front desk options stay as the alternative); when the room is confirmed, a "Your room: Room N" line. Dates via `formatDate`.
- BookingCard: "Send payment link" next to "Record payment", shown only when `balanceProblem` is null.

- [ ] **Step 1: Write the failing tests**: `sendPaymentLink` returns `UNAUTHORIZED` for non-staff; refuses a fully paid booking with the nothing-left sentence and sends nothing; on an owing booking calls the email mock once with the owed amount and writes the audit entry; a throwing email mock still returns ok. Email test (extend the existing email test if there is one, else assert via the reminder route test): reminder HTML contains "Pay balance" when owing and "Room 8" only when `room_confirmed`.
- [ ] **Step 2: Run** the new tests. Expected: FAIL.
- [ ] **Step 3: Implement** the action, button, emails, WhatsApp text and the cron select.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Staff send a payment link; the arrival email links to Pay balance and shows the room"`

### Batch A gate and push

- [ ] Run `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run check:imports`, `npm run build`. Expected: all pass.
- [ ] Ask the owner to run `supabase/migration-portal-v2.sql` on the **preview** Supabase project and confirm. Do not push before that (the portal now reads `room_access_codes`).
- [ ] `git push origin redesign`; wait for the Vercel preview to succeed.
- [ ] In the browser (preview, test admin login from memory): set a door code on a room, confirm that room on a test booking, and send a payment link from a part-paid test booking (the email arrives if Resend works). The Pay balance button itself comes in Task 5, so paying is checked after Batch B. Report results.

## Batch B: the new portal

### Task 5: Portal page: header, balance card, Pay balance, payment return

Use the `gagrafa-frontend-design` skill. Mobile first (most guests open it on a phone).

**Files:**
- Create: `src/components/portal/PortalHeader.tsx`, `BalanceCard.tsx`, `PayBalanceButton.tsx` (client), `ArrivalCard.tsx`, `PaymentReturnNotice.tsx`, `src/lib/portal/return.ts`, `src/lib/portal/return.test.ts`
- Modify: `src/app/portal/[code]/page.tsx` (rebuild from the components; keep requests, house rules, emergency contacts, cancellation, review; remove "Nearby"), `src/lib/property.ts` (`CHECK_IN_LABEL = "2 PM"`, `CHECK_OUT_LABEL = "11 AM"`)

**Interfaces:**
- Produces in `src/lib/portal/return.ts`: `returnReferenceFor(code: string, params: { reference?: string; trxref?: string }): string | null`: the reference only when `parseBalanceReference` of it equals `code`; else null.
- Page: `searchParams: Promise<{ reference?: string; trxref?: string }>`; when `returnReferenceFor` gives a reference and `isOverLimit("paymentCheck")` is false, call `confirmPaymentByReference` **before** loading the booking so the page shows the new balance; pass the outcome to `PaymentReturnNotice`: paid "Thank you. We've received your payment of X." (X from the payment row), failed "Your payment wasn't completed, so you haven't been charged.", needs_review "We've received your payment. Our team will be in touch shortly.", anything else nothing.
- `PortalHeader { imageSrc, unitName, checkIn, checkOut, nights, guests, code, firstName }`: the type's first photo (`unit.images[0] ?? APARTMENT_FALLBACK_IMAGE`) with a navy gradient, "Welcome, <first name>", type, `formatDate` dates, nights, guests, booking code.
- `BalanceCard { total, paid, owed, currency, bookedSuffix, canPay, bookingId }`: total, paid, a progress bar (`paid / total`, clamped 0–100), "Balance due by arrival X" and `PayBalanceButton` when `canPay`; "Paid in full" when owed ≤ 0.005. Hidden for cancelled bookings (the cancelled card stays as today).
- `PayBalanceButton { bookingId, owed, currency }`: calls `payBalance`, on ok `window.location.assign(url)`, on error `toast.error`; disabled while pending; label "Pay balance · X".
- `ArrivalCard { roomText, accessState, accessMessage, doorCode, wifi, entryInstructions, address }`: "Your room", "Check-in from 2 PM", "Check-out by 11 AM", address; door code, Wi-Fi, entry instructions only when `accessState === "show"`, else the message.

- [ ] **Step 1: Write the failing test** `return.test.ts`: matching code returns the reference (from `reference` or `trxref`); another booking's balance reference → null; a plain booking code → null; junk / missing → null.
- [ ] **Step 2: Run** `npx vitest run src/lib/portal/return.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the helper, components and page.
- [ ] **Step 4: Run** `npm test`; then `npm run dev` and open a test booking's portal at 375 px and desktop width in the browser: part-paid, paid in full, pending, cancelled, and a stay with an unconfirmed room the day before arrival. Expected: PASS; no horizontal scroll at 375 px; no hydration warnings in the console; the Pay balance button opens Paystack test checkout.
- [ ] **Step 5: Commit** `git commit -m "New guest portal: photo header, balance card with Pay balance, arrival by room"`

### Task 6: Quick buttons: directions, WhatsApp, calendar file, receipt

**Files:**
- Create: `src/components/portal/QuickActions.tsx`, `src/lib/portal/ics.ts`, `src/lib/portal/ics.test.ts`, `src/app/portal/[code]/calendar.ics/route.ts`, `src/app/portal/[code]/receipt/page.tsx`, `src/lib/receipt.ts`, `src/lib/receipt.test.ts`
- Modify: `src/app/admin/bookings/[id]/receipt/page.tsx` (use `src/lib/receipt.ts`), `src/app/portal/[code]/page.tsx`, the public header/footer (`print:hidden`) so the portal receipt prints alone

**Interfaces:**
- Produces in `src/lib/portal/ics.ts`: `stayIcs(input: { code: string; unitName: string; checkIn: string; checkOut: string; address: string; portalUrl: string; now: Date }): string`: one VEVENT, CRLF line endings, `UID:<code>@thegagrafa`, `DTSTART:<checkIn as YYYYMMDD>T140000Z`, `DTEND:<checkOut>T110000Z`, `DTSTAMP` from `now`, `SUMMARY:Stay at The Gagrafa (<unitName>)`, `LOCATION:` the address, `DESCRIPTION:` booking code and portal URL; commas, semicolons, backslashes and newlines escaped per RFC 5545. No door code or Wi-Fi in the file.
- Route `GET /portal/[code]/calendar.ics`: `hasPortalAccess` else 404; cancelled / no-show → 404; `Content-Type: text/calendar; charset=utf-8`, `Content-Disposition: attachment; filename="gagrafa-<code>.ics"`, `Cache-Control: private, no-store`.
- Produces in `src/lib/receipt.ts`: `receiptFromRow(row: any): { booking: ReceiptBooking; payments: ReceiptPayment[] }`: the mapping now inline in the admin receipt page (room only when `room_confirmed`, payments sorted by date). Both receipt pages use it.
- Portal receipt page: `hasPortalAccess` else redirect to verify (as the portal page does); renders `<Receipt>` with a "Back to your stay" link and `PrintButton`.
- `QuickActions { directionsHref, whatsappHref, calendarHref, receiptHref }`: four buttons in a 2×2 grid on phones, one row on desktop; Directions = `https://www.google.com/maps/search/?api=1&query=` + `encodeURIComponent(settings.address)`; WhatsApp = `whatsappHref(settings.whatsapp_number)` and hidden when null; the calendar button hidden for cancelled bookings.

- [ ] **Step 1: Write the failing tests.** `ics.test.ts`: dates 2026-12-20 → 2026-12-23 give `DTSTART:20261220T140000Z` and `DTEND:20261223T110000Z`; lines end in `\r\n`; an address "Militia Street, Mango Link; Tema" is escaped `Militia Street\, Mango Link\; Tema`; the output contains no "door" or "Wi-Fi". `receipt.test.ts`: an unconfirmed room gives `room: null`; payments are sorted by date; a refund stays negative.
- [ ] **Step 2: Run** `npx vitest run src/lib/portal/ics.test.ts src/lib/receipt.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the helpers, route, receipt pages and buttons.
- [ ] **Step 4: Run** `npm test`; in the browser download the `.ics` (opens in Calendar with 2 PM / 11 AM), open and print-preview the portal receipt, and confirm both return 404 / the verify page in a private window. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Portal quick buttons: directions, WhatsApp, calendar file, receipt"`

### Task 7: Requests: breakfast, airport transfer, housekeeping, repair

**Files:**
- Modify: `src/components/site/ServiceRequestForm.tsx`, `src/lib/admin/inbox.ts` + `inbox.test.ts` (type words), `src/lib/notify/email.ts` (`sendServiceRequestNotification` type word, if it prints the raw type)

**Interfaces:**
- Form options in this order: Breakfast (`breakfast`), Airport transfer (`airport_transfer`), Housekeeping (`cleaning`), Repair (`maintenance`), Something else (`other`); default Breakfast; placeholder per type ("Which days, and for how many?", "Flight number and arrival time", "When suits you?", "What needs fixing?", "How can we help?").
- Inbox type words gain `breakfast: "Breakfast"`, `airport_transfer: "Airport transfer"`; `towels` keeps "Towels".
- The API route already validates against the generated enum, so it accepts the new values with no change.

- [ ] **Step 1: Write the failing test** in `inbox.test.ts`: the type word for `airport_transfer` is "Airport transfer" and for `breakfast` "Breakfast".
- [ ] **Step 2: Run** `npx vitest run src/lib/admin/inbox.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the form options and type words.
- [ ] **Step 4: Run** `npm test`; send an airport transfer request from a test portal and see it in Admin → Inbox. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Portal requests: breakfast, airport transfer, housekeeping, repair"`

### Batch B gate and push

- [ ] Run the full gate (as in Batch A). Expected: all pass.
- [ ] `git push origin redesign`; wait for the preview build to succeed.
- [ ] On the preview with Paystack **test** keys, as a guest of a part-paid test booking: open the portal from the emailed link, pay the balance (test card), come back to the thank-you notice and "Paid in full"; check the webhook also recorded it once (one `success` row); confirm a room and set its door code, then see it in the portal on the day before arrival; download the calendar file; open the receipt; send an airport transfer request. Report results with screenshots at phone width and wait for the owner's look.
- [ ] Update `PLAN.md` / memory: Phase 4 shipped, next is Phase 5 (Airbnb sync).
