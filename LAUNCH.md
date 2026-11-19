# Launch runbook (Phase 6)

Steps that live in dashboards, not in the code. Tick each one off before pointing the real domain at Vercel.

## 1. Domain and site URL
- [ ] Pick the production domain and add it in Vercel → Project → Settings → Domains.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the full **https** URL, no trailing slash (e.g. `https://www.thegagrafa.com`). Fixed for the Vercel URL on 2026-10-25 (robots.txt shows `https://my-gagrafa.vercel.app/sitemap.xml`); set it again for the real domain. It feeds the Paystack callback, magic links, sitemap and share previews.
- [ ] Redeploy after any env change (Vercel reads them at build time).

## 2. Email (Resend)
- [ ] Add and verify the sending domain in Resend (DNS records at the domain registrar).
- [ ] Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (an address on the verified domain) and `ADMIN_NOTIFICATION_EMAIL`.
- [ ] Admin → Settings: set the contact email and phone. Until then the site shows the temporary fallback in `src/lib/site-settings.ts`.

## 3. Content
- [ ] Admin → Units: each of the five units still has an Unsplash stock photo from the seed data (seen 2026-10-24). Upload real photos, "make main" on one of them, and delete the stock one. The main photo is also the unit's share preview.
- [ ] Check unit prices are in dollars (Settings currency is USD; live site prices: $100 Studio to $300 Penthouse).

## 4. Environment variables on Vercel
Every name in `.env.example` that applies: Supabase URL / anon / service-role keys, Paystack public + secret, Resend, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, `ADMIN_NOTIFICATION_EMAIL`, `PORTAL_SESSION_SECRET`, Twilio (optional), `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_URL` (optional).

## 5. Paystack
- [ ] Dashboard → Settings → API Keys & Webhooks: webhook URL `https://<domain>/api/webhooks/paystack`, callback URL is sent per payment by the app.
- [ ] Full test-key pass (Phase 5): card, MoMo, failed payment, abandoned checkout, paid after the 30-minute hold, webhook retry, refunds at each tier.
- [ ] Only then swap both keys to live, redeploy, and re-enter the webhook URL on the live side.

## 6. Cron
- [ ] Vercel → Project → Cron Jobs shows `/api/cron/reminders` daily at 08:00 UTC, and the first run returns 200 (needs `CRON_SECRET`).
- [ ] Airbnb sync database: `supabase/migration-airbnb.sql` runs on the live database as part of the cutover (section 8).
- [ ] Airbnb sync scheduler: set up a free scheduler (for example cron-job.org) to call `https://<domain>/api/cron/airbnb-sync` every 15 minutes with header `Authorization: Bearer <CRON_SECRET>`; the daily Vercel cron is only the fallback (Vercel Hobby allows daily crons only). A call without the header returns 401.

## 7. Backups (Supabase)
- [ ] Supabase → Database → Backups: confirm daily backups are listed. They come with paid plans; on the free plan, take a manual `pg_dump` before each migration. (Needs confirmation against the project's plan.)

## 8. Cutover: `redesign` to live, and rollback

The live database must change at the same time as the app. Neither side works with the other's old version:
- The old app (`main`) inserts bookings without a room, which `migration-rooms.sql` refuses (`bookings_room_required`).
- The new app (`redesign`) reads columns and tables that only exist after migrations 10–13.

So the live site can't take bookings between step 3 and the end of step 5. Keep that gap to a few minutes. There is no switch to pause bookings.

`reset-and-seed.sql` (step 4) **deletes** every booking, payment, unit, room, promo code, contact message, audit entry, special price, guest note and door code. It keeps staff logins (profiles), Tour photos and most Settings. Without a backup, that data can't be recovered.

### Before the day
- [ ] Decide that the live bookings and payments can be deleted. If any real future booking must stay, stop: the reset script would remove it, and a different migration path is needed.
- [ ] Note anything you'll re-enter afterwards: promo codes, door codes, Wi-Fi and entry details, the USD exchange rate.
- [ ] Vercel → Settings → Environment Variables: every variable in section 4 is set for **Production**, not only Preview (`PORTAL_SESSION_SECRET` and `CRON_SECRET` included).
- [ ] Have `redesign` ready to merge, with the pre-ship check passed on its latest commit.
- [ ] Note the current production deployment in Vercel → Deployments. It is the rollback target.

### On the day (pick a quiet hour)
1. **Backup.** Supabase → **live** project → Connect: copy the Session pooler connection string. Then run `pg_dump "<connection string>" -Fc -f gagrafa-live-YYYY-MM-DD.dump` and keep the file somewhere safe, not in the repo. `pg_dump` must be the same major version as the database or newer. If the project is on a paid plan, also check Database → Backups shows today's backup.
2. **Nothing in flight.** Admin → Bookings: no `pending` booking from the last 30 minutes. Paystack dashboard: no payment in progress. A guest who pays during steps 3–5 would pay for a booking the reset deletes.
3. **Migrations.** In the **live** project's SQL editor (check the project name first), run each whole file in this order: `supabase/migration-rooms.sql`, `supabase/migration-admin.sql`, `supabase/migration-portal-v2.sql`, `supabase/migration-airbnb.sql`. Stop at the first error.
4. **Reset.** Run `supabase/reset-and-seed.sql`. It creates the 5 apartment types and the 13 rooms.
5. **Deploy.** Merge `redesign` into `main` and push. Vercel builds and promotes production. Wait until the deployment shows Ready.
6. **Check.** These should all work:
   - `https://<domain>/api/health` returns `{ "ok": true }`
   - the home page and each apartment page load
   - an admin can sign in and see 13 rooms on Today
   - a test booking reaches the Paystack page (cancel it there; the hold is released)
7. **Re-enter.** Admin → Settings: the USD exchange rate, reception hours, Wi-Fi and entry details. Then add door codes per room, promo codes, and Airbnb links on the Rooms page (each room gets a new export link; give the new links to Airbnb).
8. **Watch.** Watch the Vercel logs and the admin alert emails for the rest of the day.

### Rollback
- **Before step 3:** nothing has changed. Stop.
- **After step 3, before step 4** (migrations ran, nothing deleted): in the SQL editor, run the `-- ROLLBACK` block at the end of each migration, newest first: `migration-airbnb.sql`, `migration-portal-v2.sql`, `migration-admin.sql`, `migration-rooms.sql`. The old app then works again.
- **After step 5** (new app live, something is wrong):
  - If it's a bug in the app and bookings still work, fix it forward. The database already matches the new app.
  - If the old site must come back: Vercel → Deployments → the deployment noted earlier → Instant Rollback. Then run the four ROLLBACK blocks as above. Instant Rollback stops new pushes promoting automatically until you promote again. Bookings made on the new site lose their room numbers. The rooms rollback fails if two of them overlap in the same apartment type; cancel one first.
  - Bookings deleted by step 4 only come back from the step 1 dump. **Needs confirmation:** restoring a dump into a Supabase project hasn't been tried here. Rehearse it on a copy before relying on it.
- Never roll the database back without rolling the app back first, or the new app breaks.

## 9. Checklist items left open in CLAUDE.md
- [x] #2 reset link expiry (done 2026-10-26)
- [x] #5 Supabase sign-in rate limits (done 2026-10-26, 429 confirmed)
- [x] #8 uptime monitor on `/api/health` (done 2026-10-26). Vercel error alerts need the Pro plan; on Hobby we rely on the uptime monitor plus the app's admin alert emails.
- [ ] When the real domain goes live, point the uptime monitor at it.
