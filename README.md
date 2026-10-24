# The Gagrafa — Booking Website, Guest Portal & Admin Dashboard

"Live Luxuriously, Stay Serenely." A booking platform for The Gagrafa, a luxury
serviced apartment complex in Spintex / Community 20, Accra.

## What's in this scaffold

This is a working Next.js 15 (App Router) + TypeScript + Tailwind + Supabase
starting point, built to match the full brief. Given the size of the brief
(public site + guest portal + admin dashboard + payments + notifications),
it's organized into three tiers of completeness so you can see exactly
what's ready to run and what's next:

**Fully implemented**
- Database schema with RLS policies, an availability function that prevents
  double-booking, an auto-profile-on-signup trigger, seed data for the five
  real Gagrafa unit types, and a `contact_messages` table (`supabase/schema.sql`)
- Design system: navy/charcoal + champagne-gold palette, Playfair Display +
  Inter type, reusable button/card classes (`tailwind.config.ts`, `globals.css`)
- Centralized Zod validation (`src/lib/validations.ts`) for bookings, contact
  messages, unit edits, and manual bookings — shared between client forms
  and server actions
- Public site: homepage (with a live published review as its testimonial,
  once one exists), residences listing, residence detail with a live price
  calculator, header/footer, responsive layout
- Booking flow: 3-step (dates & unit → guest details → review & pay). Step 3
  calls a single server action (`src/app/booking/actions.ts`) that validates
  input, re-checks availability, creates the booking, emails the admin a
  new-booking notification, and initializes a Paystack transaction (card,
  Mobile Money, bank transfer) — then redirects to Paystack's checkout
- Payment verification: the success page (`/booking/success`) verifies the
  transaction server-side against Paystack before showing a confirmation,
  and the webhook does the same server-to-server as a backup — both share
  `src/lib/booking-payment.ts`, so a booking is only ever marked paid once,
  and a confirmation email + WhatsApp message fire exactly once, on the
  first successful confirmation
- Guest portal: booking-code lookup, stay summary, check-in/Wi-Fi/house-rules
  info cards, a service-request form (emails the admin on submit), and a
  star-rating review form that appears once a stay is `checked_out`
- Auth: `/login` (Supabase email/password) and middleware that gates every
  `/admin/*` route behind `profiles.role` in ('admin', 'staff')
- Admin dashboard:
  - **Overview** — live counts (check-ins/outs today, month revenue, pending requests)
  - **Bookings** — search (name/email/code), status + payment filters,
    one-click Confirm/Check In/Check Out/Cancel, special requests shown inline
  - **New booking** (`/admin/bookings/new`) — manual booking for phone/walk-in
    guests, with an optional "mark as paid" (cash/bank/Mobile Money) that
    writes a matching `payments` row
  - **Units** — inline editing of name, price, guest capacity, description,
    and an Active/Inactive toggle that immediately hides a unit from the
    public site
  - **Availability** — block/unblock date ranges per unit (maintenance, owner
    stays, etc.), enforced by the same function that blocks double-bookings
  - **Service Requests** — status flow (Start → Mark complete, or Cancel)
  - **Reviews** — approve/publish or delete guest reviews; published ones
    appear as the homepage testimonial
  - **Guests** — every past/current guest, grouped from bookings by email,
    with stay count, total paid, and last check-in; searchable by name/email
  - **Payments** — every transaction (Paystack, cash, bank, Mobile Money)
    with a method filter and running total collected
  - **Settings** — property name/tagline/address/contact info, and the admin
    notification email used by the alerts above (falls back to
    `ADMIN_NOTIFICATION_EMAIL` if left blank) — backed by a new
    `property_settings` table (singleton row, seeded by `schema.sql`)
- Contact page: form (name/email/message) that saves to `contact_messages`
  and best-effort emails the team via Resend if `RESEND_API_KEY` is set,
  plus contact details and a success state
- Email notifications (`src/lib/email.ts`, via Resend): guest booking
  confirmation, admin new-booking alert, admin service-request alert — all
  best-effort (a missing/misconfigured `RESEND_API_KEY` just logs a warning
  and skips, never blocks the underlying action)
- WhatsApp notifications (`src/lib/whatsapp.ts`, via Twilio's REST API):
  guest booking confirmation, same best-effort guarding as email

**Beyond the original brief, added on request**
- **Pre-arrival & post-stay emails** — `/api/cron/reminders`, scheduled daily
  via `vercel.json` (needs `CRON_SECRET` set as a Vercel project env var).
  Sends a reminder the day before check-in and a review-request email the
  day after check-out, each exactly once (tracked by `reminder_sent_at` /
  `review_request_sent_at` on the booking)
- **Booking calendar** (`/admin/calendar`) — month grid, color-coded by
  status, click a stay to jump to its record in Bookings
- **CSV export** — a button on Bookings (staff+) and Payments (admin only)
  that downloads the full table
- **Discount/promo codes** — `/admin/promo-codes` (admin only); percent or
  fixed-amount, optional max uses and date window. Applied live in the
  booking flow with a working "Apply" button; usage only counts once a
  booking is actually paid for, via an atomic DB increment (two guests
  can't both slip past a max-uses limit in a race)
- **Reports** (`/admin/reports`, admin only) — 30-day revenue and occupancy,
  as simple SVG bar charts (no charting library needed)
- **Spam protection** — honeypot field + minimum-fill-time check + a
  per-email rate limit on both the contact form and the booking flow, all
  using existing tables, no CAPTCHA keys required
- **SEO basics** — `src/app/sitemap.ts` and `robots.ts` (Next's app-router
  convention, no new files needed to render them), plus JSON-LD
  (`LodgingBusiness` site-wide, `Product`/`Offer` per residence)
- **Staff vs. admin split** — `src/lib/auth.ts` adds `isAdmin()`/`isStaff()`.
  Reports, Promo Codes, Payments, Settings, and Audit Log are admin-only
  (hidden from staff in the sidebar *and* checked again inside each
  page/action — hiding a nav link alone isn't real access control)
- **Audit log** (`/admin/audit-log`, admin only) — every booking-status
  change, manual booking, unit edit, availability block, review moderation,
  settings change, and promo code change, with who did it and when

**Integration points marked with `// TODO` or needing real credentials**
- Supabase Storage image upload for units
- Twilio WhatsApp: works once you have a verified sender — note that
  Twilio's *sandbox* number requires each recipient to text a join code
  once before it can message them; production needs a Meta-approved
  WhatsApp Business sender

This isn't a small brief — it's a full three-surface product, and it's grown
with every round of requests. Rather than generate a pile of unreviewed,
unrunnable code in one pass, each feature here was built to actually run
against the real schema and RLS policies already in place, and this round
got a second pass specifically checking imports, schema alignment, and one
real bug (the occupancy calculation) before being handed over. **For testing
the Paystack, cron, and WhatsApp flows against live accounts, Claude Code
(desktop or terminal) is a much better fit than chat** — it can run
`npm install`, start the dev server, and iterate against real errors as you
hit them.

## Setup

1. **Supabase**
   - Create a project at supabase.com
   - Run `supabase/schema.sql` in the SQL editor (creates tables, RLS, seed data)
   - Copy your Project URL, anon key, and service role key into `.env.local`

2. **Environment variables**
   ```
   cp .env.example .env.local
   ```
   Fill in Supabase, Paystack, Resend, and WhatsApp provider keys.

3. **Install & run**
   ```
   npm install
   npm run dev
   ```

4. **First admin user**
   Sign up normally, then in the Supabase table editor set that user's
   `profiles.role` to `admin`.

5. **Paystack**
   - Add your secret key to `PAYSTACK_SECRET_KEY` (checkout happens on
     Paystack's hosted page, so `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` isn't used yet)
   - Set `NEXT_PUBLIC_SITE_URL` to your real URL in production — it's used to
     build the callback URL Paystack redirects back to after payment
   - Point a Paystack webhook at `/api/webhooks/paystack` — it's a backup
     confirmation path; the success page verifies the payment itself too

## Project structure

```
src/app/                  Public site, booking flow, guest portal, admin
src/app/booking/actions.ts    Server action: create booking + init Paystack payment
src/app/admin/*/actions.ts    Server actions for booking status + unit edits
src/app/api/                  Service requests, Paystack webhook
src/components/admin/         Admin-only components (booking/unit cards, filters)
src/components/site/          Public + guest-portal components
src/lib/supabase/             Browser, server, and service-role clients
src/lib/paystack.ts           Paystack initialize/verify wrapper
src/lib/booking-payment.ts    Shared payment confirmation logic
src/lib/validations.ts        Zod schemas (booking, contact, unit edits)
src/lib/types.ts              Shared types + booking code/nights helpers
src/middleware.ts             Guards /admin/* by profiles.role
supabase/schema.sql           Full schema, RLS policies, seed data
```

## Deploying to Vercel

1. Push the project to GitHub and import it into Vercel.
2. In **Settings → Environment Variables**, add every variable from `.env.example`
   (Supabase, Paystack, Resend, Twilio if used, `ADMIN_NOTIFICATION_EMAIL`,
   `CRON_SECRET`). Set `NEXT_PUBLIC_SITE_URL` to your real production URL.
   Vercel only reads variables at build time, so **redeploy after adding or changing any**.
3. Database: on a brand-new Supabase project, run all of `supabase/schema.sql`
   once. On a project that already has the tables, never re-run the whole file —
   run only the new blocks you need (each addition at the bottom is written to be
   safe to run on its own).
4. Resend: you can only send *from* a domain you've verified in Resend
   (a Gmail address won't work). Until then, mail only reaches your own Resend
   account address.
5. Paystack: point the webhook at `https://YOUR-DOMAIN/api/webhooks/paystack`.
6. The daily job (`vercel.json`) sends reminder emails and clears abandoned checkouts.
   It **requires `CRON_SECRET`** and refuses to run without it.
7. Run `supabase/migration-booking-safety.sql` (follow the steps inside it). It makes unpaid
   checkouts release their dates after 30 minutes, and adds a database-level guard so two
   guests can never end up holding the same dates.

### Database migrations

Run these in the Supabase SQL Editor, in this order, once each (skip any you've already run):

1. `supabase/migration-booking-safety.sql` — follow the steps inside it.
2. `supabase/migration-portal-and-ops.sql` — adds the guest-portal attempt log, the new
   Settings columns (Wi-Fi, entry instructions, house rules, emergency contacts, reception hours),
   door codes, and the cancellation/refund columns. Safe to re-run.
3. `supabase/migration-tour-gallery.sql` — the table behind the Tour page. Safe to re-run.
4. `supabase/migration-deposits.sql` — the deposit percentage setting and the deposit column on
   bookings. Safe to re-run. Deposits switch on (at 50%) once this has been run.
5. `supabase/migration-usd-pricing.sql` — lets prices show in US dollars while Paystack charges
   cedis at the rate set in Admin → Settings. Safe to re-run. Nothing changes until you pick USD.
6. `supabase/migration-rate-limits.sql` — limits how often one visitor can book, check dates,
   try promo codes, send contact messages, open the guest portal or raise service requests.
   Safe to re-run. Until it is run the site works normally, just without these limits.
7. `supabase/migration-rls-hardening.sql` — **security fix, run as soon as possible.** Stops
   anyone who signs up from giving themselves the admin role, and closes direct database writes
   to bookings and contact messages. Safe to re-run. Afterwards, run the check at the bottom of the
   file and make sure only your own team has the admin or staff role.

### Guest portal, units, refunds and team

- **Guest portal** — guests prove who they are with their booking code plus the email or phone on
  the booking (or the link in their emails). Wi-Fi, door code and entry details only show for a
  confirmed stay, from the day before check-in until check-out.
- **Unit photos** upload straight from the browser to Supabase Storage (the `unit-images`
  bucket is created automatically on first upload), and are shrunk in the browser first.
  Door codes are stored in their own locked table, never on the public `units` table.
- **Cancellations & refunds** follow the tiers on the FAQ/Terms pages
  (`src/lib/cancellation-policy.ts`). Only admins can refund; refunds can go back through
  Paystack or be recorded as paid out by hand. Guests can *request* a cancellation from the portal.
- **Team** (`/admin/team`, admin only) creates invite links on your own domain, so no Supabase
  redirect settings are needed. The link is always shown for you to copy, since email may not
  be set up. Set `NEXT_PUBLIC_SITE_URL` first.

### Tour page and deposits

- **Tour** (`/tour`) shows three sections: your residences (pulled from each unit's photos
  automatically), the property, and the neighbourhood. Manage the last two under Admin → Tour:
  upload photos, add captions, reorder them. Photos upload straight from the browser to the
  `gallery-images` bucket (created automatically). Each residence page also has a gallery with a
  full-screen viewer.
- **Deposits**: when check-in is at least 7 days away, guests can reserve by paying a share of
  the total now (50% by default, change it in Admin → Settings; 0 turns it off) and pay the rest
  at check-in. Staff record the balance with "Record payment" on the booking. The rules live in
  `src/lib/deposit.ts`, and the server re-checks them whatever the browser sends. Refunds apply
  the usual cancellation tiers to whatever has actually been paid.

### Next.js 15 notes

This project targets Next.js 15, where `cookies()`, `params`, and `searchParams`
are async. Pages type them as `Promise<...>` and `await` them, and
`createClient()` in `src/lib/supabase/server.ts` is async — always call it as
`await createClient()`. Run `npm run build` locally before pushing; it catches
the same type errors Vercel would.
