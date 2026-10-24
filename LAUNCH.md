# Launch runbook (Phase 6)

Steps that live in dashboards, not in the code. Tick each one off before pointing the real domain at Vercel.

## 1. Domain and site URL
- [ ] Pick the production domain and add it in Vercel → Project → Settings → Domains.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the full **https** URL, no trailing slash (e.g. `https://www.thegagrafa.com`). On 2026-10-24 production served `Sitemap: http://my-gagrafa.vercel.app/sitemap.xml`, so the variable is currently set with `http://`. It feeds the Paystack callback, magic links, sitemap and share previews.
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

## 7. Backups (Supabase)
- [ ] Supabase → Database → Backups: confirm daily backups are listed. They come with paid plans; on the free plan, take a manual `pg_dump` before each migration. (Needs confirmation against the project's plan.)

## 8. Rollback
- **App:** Vercel → Deployments → the previous production deployment → "Instant Rollback" (or `vercel rollback`). This switches traffic with no rebuild. A rolled-back production stops auto-promoting new pushes until you promote again.
- **Database:** each migration in `supabase/` ends with a `-- ROLLBACK` block. Migrations are additive, so the previous app version keeps working against the new schema; roll the app back first and the database only if needed.

## 9. Checklist items left open in CLAUDE.md
#2 reset link expiry, #5 Supabase sign-in rate limits, #8 uptime monitor on `/api/health` and Vercel error alerts.
