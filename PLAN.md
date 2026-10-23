# The Gagrafa: Project Plan

Goal: a booking platform that runs smoothly with no build breaks or runtime errors, has a clean architecture, and then gains the deferred features in a controlled order.

Work in phases. Finish a phase's exit gate before starting the next. After every phase run `npx tsc --noEmit` and `npm run build`, then commit.

## Target architecture

```
src/
  app/                  Routes only. Pages fetch and render; no business logic.
    (public)/           Marketing + booking flow
    portal/[code]/      Guest portal
    admin/              Staff/admin dashboard (each section has page.tsx + actions.ts)
    api/                Webhooks, cron, health only
  components/
    ui/                 Generic primitives (button, dialog, skeleton)
    site/               Public-site components
    admin/              Dashboard components
  lib/
    env.ts              Single zod-validated env module (fail fast, one place)
    auth.ts             getCurrentProfile, isStaff, isAdmin, UNAUTHORIZED
    supabase/           server.ts (async), client.ts, service role helper
    booking/            availability, pricing, codes, cancellation policy
    payments/           paystack client, confirmPaymentByReference, refunds
    notify/             email (Resend), whatsapp (Twilio), templates
    validations.ts      zod schemas shared by client and server
    rate-limit.ts       (new) limiter used by public actions and API routes
    logger.ts           (new) structured logger that redacts PII
  types/                Generated Supabase types (`supabase gen types`)
supabase/               schema.sql + ordered, idempotent migrations
```

Layering rule: UI → server action (auth + zod validate) → `lib/` domain function → Supabase. Actions stay thin. Domain functions are pure where possible, so they can be unit-tested.

Principles:
1. One source of truth for money and dates (no ad-hoc math or locale formatting in components).
2. The database is the last line of defence (RLS, exclusion constraint, unique booking code).
3. Third-party calls (email, WhatsApp) are best-effort and never block a booking.
4. Every public write goes through zod validation and a rate limit.

## Phase 0: Baseline (stabilize)
- Put the source in git on a branch; deploy from `main` only after the gate below passes.
- Run `npm install`, `npx tsc --noEmit`, `npm run build`, `npm run lint`. Fix everything; no `any`, no `@ts-ignore`.
- Add `src/lib/env.ts` (zod) and replace scattered `process.env` reads. Keep `||` fallbacks for empty strings.
- Add `/api/health` (DB ping) and confirm Vercel env vars match `.env.example`.
- Add Vitest and unit tests for: `confirmPaymentByReference` scenarios, cancellation tiers, nights/price maths, booking-code generation.
- **Exit gate:** clean type check, clean build, tests green, app boots with only `.env.local`.

## Phase 1: Reliability and hardening
- Add `not-found.tsx`, `error.tsx` and `global-error.tsx`, plus loading skeletons and intentional empty states for every list.
- Rate limiting (429, not a crash) on: booking creation, portal access, contact form, promo-code check, password/invite flows. The portal already throttles 8 per 15 min; reuse that pattern or add a shared limiter.
- Security headers in `next.config.mjs` (CSP, HSTS, frame-ancestors, referrer policy). Confirm no secrets in client bundles.
- Logging: `lib/logger.ts` with PII/token redaction; log payment and booking failures. Hook Vercel log drains or an error monitor, with alerts for payment/booking failures.
- Database: review indexes on `bookings(unit_id, check_in, check_out)`, `bookings(booking_code)`, `payments(booking_id)`, `payments(paystack_reference)`, `service_requests(booking_id)`. Index only what queries use.
- Review RLS policies table by table (guest sees only own rows; staff/admin per role).
- Make sure every migration has a documented rollback or is backward-compatible.
- **Exit gate:** the pre-ship checklist in `CLAUDE.md` is all Pass or Not applicable.

## Phase 2: Architecture tidy
- Generate Supabase types and remove hand-written row types.
- Move booking, payment and notification logic into `lib/booking`, `lib/payments`, `lib/notify` as in the target tree. Keep exports stable so imports don't break.
- Single `formatMoney` / `formatDate` helpers (fixed format; no locale at render time).
- Run the named-import check: every `import { X } from "@/..."` resolves to a real export.
- **Exit gate:** no behaviour change; tests and build still green.

## Phase 3: Homepage redesign (see `DESIGN.md`)
- Video hero with parallax, scroll reveals, sticky glass header, floating "Book Your Stay" button.
- Performance budget: LCP under 2.5 s on throttled 4G; hero video under 2 MB; respects reduced-motion and data-saver.
- **Exit gate:** Lighthouse mobile performance 85+, accessibility 95+, no layout shift from the hero.

## Phase 4: Deferred features (from `gagrafa-photos-tour-deposits.zip`)
Apply in this order, one commit each, running the full gate after each:
1. Unit photos: show uploads on unit pages, "make main" works, edit photos inside unit edit. Needs `lib/storage.ts`, `image-prepare.ts`, `UnitGallery`, `Lightbox`.
2. Check-out defaults to check-in + 1 day (`lib/dates.ts`).
3. Tour gallery: `/tour`, admin `TourManager`, `migration-tour-gallery.sql`.
4. Reservation deposit (default 50%, confirmed): `lib/deposit.ts`, `migration-deposits.sql`, booking flow option, remaining balance shown in portal/admin, cron reminder for balance.
- Re-run the Node/Vitest scenarios for payments and deposits.

## Phase 5: Payments completeness
- 100%-off promo path: if the total is 0, skip Paystack, confirm the booking directly, and record a zero payment/promo audit entry.
- Test end to end with Paystack **test** keys: card, MoMo, failed payment, abandoned checkout, paid-after-expiry, webhook retry, refund tiers.

## Phase 6: Launch
- Verify the Resend sending domain; set Vercel env vars (`NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, all keys); add the Paystack webhook; confirm the cron runs.
- Replace placeholder Terms/Privacy/contact details and sample images; check metadata, Open Graph and sitemap.
- Enable Supabase backups; note the Vercel instant-rollback procedure; keep the previous deployment ready to promote.
- Swap to live Paystack keys only after a full test-key pass.
- Run the full security review described in `CLAUDE.md`.

## Risks to watch
- Source copies drifting from the deployed repo (this caused most past build failures). Treat the git repo as the single source.
- Running SQL out of order or re-running `schema.sql`.
- Next 15 async APIs (`cookies`, `params`, `searchParams`).
- Nothing has been exercised against live Supabase/Paystack/Resend/Twilio yet; budget time for integration bugs.

## Open questions for Frank
- Final reference site details for the homepage (see `DESIGN.md`, "Assumptions to confirm").
- Is the hosting/production domain decided? Which Resend sending domain?
- Real property photos and a 5-second hero clip: who supplies them?
