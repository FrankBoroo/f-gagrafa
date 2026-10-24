# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# The Gagrafa

Luxury serviced apartments, Spintex / Community 20, Accra. Tagline: "Live Luxuriously, Stay Serenely".
Three parts in one Next.js app: public direct-booking site, guest portal, admin/property dashboard.

## Open pre-deployment items (owner to check in dashboards)
Left open on 2026-10-23 when Phase 0 shipped. They are not in the code, so they can't be verified from the repo; ask the owner before marking them Pass.
- [ ] **#2 Password reset**: Supabase → Authentication → Email: set link (OTP) expiry to 1800 s or less. Invite/recovery links are made only by admins in `src/app/admin/team/actions.ts`.
- [ ] **#5 Rate limiting**: Supabase → Authentication → Rate Limits: confirm sign-in limits are on (login is `signInWithPassword` in `src/components/site/LoginForm.tsx`). Public actions (booking, availability, promo, contact, portal, service requests) are limited per visitor in `src/lib/rate-limit.ts` once `migration-rate-limits.sql` has been run.
- [ ] **#8 Monitoring**: add an uptime monitor (UptimeRobot / Better Stack) on `/api/health`, and Vercel error alerts. In code: payment mismatches, paid-but-unconfirmed bookings, failed booking inserts and failed Paystack checkouts email the admin (`sendAdminSystemAlert` / `sendAdminPaymentConflictAlert`, needs a working Resend key), and every failure is a JSON line in the Vercel logs via `src/lib/logger.ts`. Server down still needs the external monitor.

## Stack
- Next.js 15.5 App Router, TypeScript (strict), Tailwind (navy / champagne / ivory / sand palette), Playfair Display + Inter
- Supabase: Postgres + RLS, Auth, Storage (`@supabase/ssr ^0.7`)
- Paystack (card, MoMo, bank; initialize / verify / refund / webhook), Resend email, Twilio WhatsApp via `fetch`
- zod, react-hook-form, sonner, lucide-react
- Deploys to Vercel from GitHub (`FrankBoroo/f-gagrafa`, branch `main`). Cron in `vercel.json`: daily 08:00 UTC, `/api/cron/reminders`

## Commands
- `npm run dev` : local dev (needs `.env.local`, copy from `.env.example`)
- `npx tsc --noEmit` : type check. **Run before every push.**
- `npm run build` : production build. **Run before every push.** Vercel fails on type errors.
- `npm run lint` : ESLint (`next lint`, config in `.eslintrc.json`).
- `npm test` : Vitest unit tests (`src/**/*.test.ts`). Single file: `npx vitest run src/lib/booking/deposit.test.ts`; by name: `npx vitest run -t "deposit"`. **Run before every push.**
- `npm run build` type-checks app code only, not test files, so keep running `npx tsc --noEmit` too.
- `npm run db:types` : regenerate `src/types/database.ts` from `supabase/*.sql` (PGlite, no Docker or login). Run after any migration change; new migration files must be added to `SQL_FILES` in `scripts/gen-db-types.mjs`.
- On Windows, if the build fails with `Debug Failure. Expected ...\.tsbuildinfo`, delete `.next/cache/.tsbuildinfo` and rebuild.
- `/api/health` returns `{ ok: true }` when the app can reach the database (503 otherwise).

## Rules that have caused build failures before
- Next 15: `cookies()`, `params` and `searchParams` are Promises. Type them as `Promise<...>` and `await` them.
- `createClient()` in `src/lib/supabase/server.ts` is async: `await createClient()`.
- `createServiceClient()` uses the service-role key. Server-only, never import in client components.
- Files named `actions.ts` ("use server") may only export async functions and types. No constants.
- Every staff-level server action must call `isStaff()` / `isAdmin()` from `src/lib/auth.ts` and return `UNAUTHORIZED` on failure.
- Callbacks passed to `startTransition(async () => ...)` must return void. Never `return toast.error(...)`; call it, then `return;`.
- Read env vars through `src/lib/env.ts` (public `NEXT_PUBLIC_*`, `siteUrl()`) or `src/lib/env.server.ts` (secrets, `serverEnv` / `requireServerEnv`), never `process.env` directly. Both treat empty strings as unset, because `.env.example` ships blanks; any other fallback uses `||`, not `??`.
- Annotate callback parameters explicitly (strict mode flags implicit `any`).
- Keep email / WhatsApp sends best-effort. They must never block or fail a booking.
- Money and dates shown to people (pages and emails): use `formatMoney` / `formatDate` / `formatDateTime` / `formatMonthYear` from `src/lib/format.ts`. Never `toLocaleString`, `toLocaleDateString` or `Intl` (hydration warnings, server-locale output). Date arithmetic and "YYYY-MM-DD" keys: `src/lib/booking/dates.ts`.

## Architecture notes
- **Access gates**: `src/middleware.ts` only guards `/admin/:path*` (signed in + role staff/admin). Pages and actions still re-check with `isStaff()` / `isAdmin()`; the guest portal has its own cookie check, not middleware.
- **Server actions** live in `src/app/**/actions.ts`. Client code wraps results with `asResult()` from `src/lib/action-result.ts`.
- **Payments**: `confirmPaymentByReference` in `src/lib/payments/booking-payment.ts` is shared by the success page and the Paystack webhook and is idempotent. The booking code is the Paystack reference. It returns `paid | failed | needs_review | closed`, handles payment after expiry, and never revives cancelled/refunded bookings.
- **Double-booking protection**: `is_unit_available()` ignores unpaid pending holds older than 30 min; `expire_stale_pending_bookings()` cancels them; GiST exclusion constraint `bookings_no_overlap` blocks overlaps (Postgres error 23P01).
- **Guest portal**: booking code + email/phone check, per-booking HMAC-signed HttpOnly cookie (`src/lib/portal-session.ts`), email magic links, failed attempts throttled 8 per 15 min (`portal_access_attempts`). Wi-Fi / door code / entry details only for confirmed stays, from the day before check-in until check-out.
- **Cancellation tiers** (`src/lib/booking/cancellation-policy.ts`): 100% refund at 7+ days before check-in, 50% at 2-6 days, 0% otherwise.
- **Refunds**: stored as negative `payments` rows with status `refunded`. Net paid = sum of `success` + `refunded` rows. Only admins refund; staff can cancel.
- **Roles**: guest | staff | admin. Admin-only pages: Reports, Promo Codes, Payments, Settings, Team, Audit Log.
- **Settings** are cached with `unstable_cache` (tag `"settings"`); revalidate the tag after changing them.
- **Uploads**: unit photos (`unit-images` bucket) and Tour photos (`gallery-images` bucket) go browser to Supabase Storage via signed upload URL (avoids Vercel's ~4.5 MB body limit). Images are shrunk client-side first (`src/lib/image-prepare.ts`).
- **Deposits** (`src/lib/booking/deposit.ts`): when check-in is 7+ days away, guests may pay a deposit share (default 50%, set in Settings; 0 disables). The server re-checks the rules; staff record the balance with "Record payment".
- **Tour**: public `/tour` page; property and neighbourhood photos managed in Admin → Tour (`TourManager`), residence photos come from unit galleries.

## Database
Run in this order in the Supabase SQL editor:
1. `supabase/schema.sql` (once only; re-running fails with "type user_role already exists")
2. `supabase/migration-booking-safety.sql` (run steps A, B, C one at a time)
3. `supabase/migration-portal-and-ops.sql`
4. `supabase/migration-tour-gallery.sql`
5. `supabase/migration-deposits.sql`
6. `supabase/migration-usd-pricing.sql`
7. `supabase/migration-rate-limits.sql`
8. `supabase/migration-rls-hardening.sql` (then run the admin/staff check at the bottom of the file)

Migrations are idempotent and each ends with a `-- ROLLBACK` block. The Supabase clients are typed with the generated `Database` type, so a query on a column that isn't in the SQL files fails the type check. Never re-run all of `schema.sql` on an existing database.
RLS rule: the app reads and writes through the service-role client after its own checks; RLS policies are the backstop for the public anon key, so keep them tight (no public inserts, no self-service role changes).

## Environment variables
See `.env.example`. Needed on Vercel too: Supabase URL / anon / service-role keys, Paystack public + secret keys, Resend key and `RESEND_FROM_EMAIL` (verified domain required), Twilio (optional), `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET` (the cron route refuses to run without it), `ADMIN_NOTIFICATION_EMAIL`, `PORTAL_SESSION_SECRET` (falls back to the service-role key if unset). Add the Paystack webhook URL `/api/webhooks/paystack` in the Paystack dashboard. Vercel reads env vars at build time, so redeploy after changing them.

## Pending / deferred work
- **Homepage design extras (optional, desktop only)**: magnetic buttons, custom cursor, grain, diagonal section. Done: video hero with parallax, see-through header, scroll reveals, floating "Book Your Stay" on phones.
- **100%-off promo codes**: Paystack rejects a zero amount, so the booking is auto-cancelled with a generic error. Needs a "no payment needed" path that confirms the booking directly.
- Replace placeholder Terms / Privacy text and contact details; verify a Resend domain.

## Not yet verified against live services
Nothing has been run end-to-end against real Supabase, Paystack, Resend or Twilio. Test first with Paystack test keys: photo upload, refunds, Team invites, payment webhook, guest emails.

## Working style
- When shipping changes, list only the files that changed unless the full source is asked for.
- Prefer small, reusable components; keep the luxury look (generous whitespace, soft shadows, calm motion).

---

## Pre-deployment checklist

Before any deploy, or whenever I ask "is this ready to ship?", go through every item below against the actual code. For each one, answer **Pass**, **Fail** or **Not applicable**, and point to the file or config that shows it. Don't mark something Pass on assumption. If you can't find evidence, say so.

Don't tell me to deploy until every item is Pass or Not applicable. If something fails, explain what's missing and offer a fix.

### 1. Data access (authorization)
- A logged-in user can only read or change their own data.
- Every query that touches user data filters by the authenticated user's ID (UUID) taken from the session or token, never from a client-supplied ID.
- Check for IDOR: changing an ID in a URL or request body must not expose another user's records.

### 2. Password reset
- Reset tokens are random, single-use and expire (30 minutes or less).
- Tokens are invalidated after use and after a password change.
- The reset endpoint doesn't reveal whether an email exists.

### 3. Input sanitization
- Every user input is validated on the server (type, length, format). Client-side checks don't count.
- All database access uses parameterized queries or the ORM. No string-built SQL. (SQL injection)
- Output is escaped or encoded before rendering, with no raw HTML from user input. (XSS)

### 4. API exposure
- CORS only allows our own domain(s), not `*`, in production.
- Endpoints that need authentication enforce it on the server.
- No secrets, API keys or debug endpoints are exposed to the client or committed to the repo.

### 5. Rate limiting
- Rate limits are active, especially on login, sign-up, password reset and any expensive or public endpoints.
- Exceeding the limit returns a 429 response, not a crash.

### 6. Error handling
- Every failure state has a handled response or a custom error screen (404, 500, network failure, empty states).
- Errors shown to users never leak stack traces, queries or internal details.

### 7. Database performance
- Indexes exist on the fields used by the main or high-traffic queries (lookups, filters, joins, sorts).
- Don't over-index. Only index what those queries actually use, to keep write overhead low.

### 8. Logging and monitoring
- Basic logs flow for requests and errors, with no passwords, tokens or personal data in them.
- Alerts are set up for critical failures (server down, error spikes, failed payments or bookings).

### 9. Rollback
- If this deploy breaks, we can roll back quickly: blue-green deploy, instant rollback on the hosting platform, or a previous build ready to promote.
- Database migrations are reversible, or backward-compatible with the previous version.

## Output format for the checklist

End with a short table:

| # | Check | Status | Evidence / fix |
|---|-------|--------|----------------|

Then give a one-line verdict: **Ready to deploy** or **Not ready**, with the blocking items.

---

## Security review

When I ask for a "security review" or "security assessment", do a full assessment of this project. This goes deeper than the checklist above. Use both approaches below. Don't hold back, but don't make anything up.

### Approach 1: Attacker's view (penetration-test mindset)
Act as a security researcher hired to break into this system.
- Map the attack surface: every route, API endpoint, form, file upload, webhook, auth flow, third-party integration and environment variable.
- For each one, describe how an attacker would try to abuse it: what they'd send, what they'd gain, and whether the code actually stops them.
- Try to chain weaknesses together. For example: user enumeration, then brute force (no rate limit), then account takeover.
- Only describe attacks in terms of this codebase. Don't run anything against live production systems.

### Approach 2: Standards-based review
Apply recognized frameworks to the project:
- **OWASP Top 10** (use the latest edition; check online which one is current). Go through each category and say whether it applies and whether the project is covered.
- **OWASP API Security Top 10**, if the project exposes an API.
- **STRIDE** threat modeling: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege. Apply it to each main component and data flow.

### Dependencies and packages
- Read the dependency files (`package.json` and its lockfile, `requirements.txt`, `pyproject.toml`, etc.) and list the installed versions.
- Run the ecosystem's audit tool where available (`npm audit`, `pip-audit`, etc.).
- Use web search to check each important package for recent CVEs, security advisories, deprecations and the current safe version. Sources include the GitHub Advisory Database, NVD, Snyk, and the package's own changelog or security page.

### Rules of evidence: no hallucination
- Every finding must point to evidence in the code: file path and line number, or the config or dependency involved.
- Every claim about a vulnerability, CVE, package version or best practice must cite a verifiable source (OWASP, NVD/CVE, GitHub Advisories, official docs) with a link.
- If you can't verify something, say so clearly and label it **Unverified** or **Needs confirmation**. Never state it as fact.
- Don't invent CVE numbers, package versions or file contents. If you haven't read a file, don't make claims about it.

### Ask questions
Feel free to stop and ask me questions at any point. For example: where it's hosted, how auth is handled, what data is sensitive, which environment is production, or anything you can't tell from the code. Ask rather than assume.

### Report format
1. **Summary**: overall risk level and the top 3 issues to fix first.
2. **Findings table**:

| # | Finding | Severity (Critical/High/Medium/Low) | Location | OWASP / STRIDE category | Source |
|---|---------|-------------------------------------|----------|-------------------------|--------|

3. **Details for each finding**: what it is, how it could be exploited, the evidence, and a concrete fix (with a code change where possible).
4. **Dependency report**: package, installed version, known issues, recommended version, source link.
5. **What's already done well**.
6. **Open questions** for me.
7. **Sources**: a list of every link cited.

---

## Project docs and skills
- `PLAN.md`: architecture and phased roadmap. Work phase by phase; finish each phase's exit gate first.
- `DESIGN.md`: homepage design (video hero with parallax). Read before touching the homepage.
- Skills in `.claude/skills/`: `gagrafa-frontend-design`, `gagrafa-supabase-migrations`, `gagrafa-payments-booking`, `gagrafa-pre-ship-check`. Use the matching skill for that kind of work.
- Third-party skill `ui-ux-pro-max` is also installed for general UI/UX checks (accessibility, layout, interaction). For brand decisions (palette, fonts, motion, look), `gagrafa-frontend-design` and `DESIGN.md` take priority; never adopt its suggested palettes or font pairings over the navy / champagne / ivory / sand palette and Playfair Display + Inter.
