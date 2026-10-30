---
name: gagrafa-payments-booking
description: Use when touching booking creation, Paystack payments, webhooks, refunds, cancellations, promo codes, deposits or the guest portal access rules for The Gagrafa.
---

# Gagrafa payments and booking flow

## Core invariants
- `confirmPaymentByReference` (`src/lib/payments/booking-payment.ts`) is the single place that confirms a payment. The success page and the Paystack webhook both call it. It must stay **idempotent**.
- Result states: `paid | failed | needs_review | closed`. Paid-after-expiry goes to `needs_review`; a cancelled or refunded booking is never revived.
- Booking code = Paystack reference.
- Verify the amount and currency from Paystack against the booking before marking paid. Verify the webhook signature (HMAC SHA-512 with the secret key) before trusting any payload.
- Prices and totals are computed on the server only; never accept an amount from the client.

## Refunds and cancellation
- Rule (`src/lib/booking/cancellation-policy.ts`): more than 72 hours before check-in (2 PM) is a full refund of what was paid; within 72 hours, after check-in or a no-show keeps one night, never below 0.
- Refunds are stored as negative `payments` rows with status `refunded`. Net paid = sum of `success` + `refunded` rows.
- Only admins refund; staff can cancel. Both log to the audit log.

## Promo codes
- Validate server-side; check expiry, usage limits, and unit/date eligibility.
- Total of 0 (100% off): Paystack rejects a zero amount. Confirm the booking directly, record the promo use, send the normal confirmation (Plan phase 5).

## Deposits (when adopted)
- Default deposit is 50% of the total (confirmed by Frank). Booking is confirmed once the deposit is paid; remaining balance tracked and shown in portal/admin.
- Use `lib/booking/deposit.ts` for all deposit maths; test it.

## Notifications
- Email (Resend) and WhatsApp (Twilio) are best-effort: wrap in try/catch and never fail or block the booking. Log failures without personal data.
- `RESEND_FROM_EMAIL` must use a verified domain.

## Guest portal access
- Booking code plus email or phone check; per-booking HMAC-signed HttpOnly cookie (`src/lib/portal-session.ts`) or email magic link.
- Failed attempts throttled (8 per 15 minutes, `portal_access_attempts`); same error message whether the code or the contact is wrong.
- Wi-Fi, door code and entry details only for confirmed stays, from the day before check-in until check-out.

## Server actions
- Files named `actions.ts` export only async functions and types.
- Staff actions call `isStaff()` / `isAdmin()` first and return `UNAUTHORIZED`.
- Results go through `asResult()` for a uniform shape.

## Tests to keep green
Payment confirmation scenarios (paid, failed, duplicate webhook, paid after expiry, refunded booking), the 72-hour refund rule, price/nights maths, deposit maths. Add a test with every change to this area.
