# Phase 2: Public Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public site's look and copy with the approved direction A: real logo, photo slideshow, five apartment rows, a proper apartment page with a working booking panel, and only real facts, so the owner can show the manager a Vercel preview.

**Architecture:** Same routes and data (`units` = apartment type, `/units` URLs stay). Real photos move into `public/` and `reset-and-seed.sql` points each type at them. New pure helpers carry the logic that can be tested (payment summary, booking link, contact links, apartment facts); components stay thin. Booking, payment and hold code is not touched, apart from the guest-facing `BookingFlow` and the panel that feeds it.

**Tech Stack:** Next.js 15.5, TypeScript strict, Tailwind, Supabase, Vitest, PGlite. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-29-redesign-design.md` (sections 4, 5, 7.1, 7.2). Approved mockups: `.superpowers/brainstorm/1884-1793125630/content/homepage-direction.html` (direction A), `apartment-page.html`, `logo-choice.html` (real logo). Read `DESIGN.md` and the `gagrafa-frontend-design` skill; where `DESIGN.md` still describes the video hero, the spec wins and Task 8 updates it.

## Global Constraints

- Direction A order: slideshow, welcome collage, five apartment rows, pool / gym / lounge photos, navy "Find us" band, round Book / Call button.
- Nightly: Studio $100, 1-Bed Standard $170, 1-Bed Executive $200, 2-Bed Executive $250, Penthouse $300. Monthly: 1-Bed Standard $1,500, 1-Bed Executive $2,000, 2-Bed Executive $2,500, Penthouse $2,500; Studio none. Up to 2 adults. Prices render from the database via `formatMoney`.
- Address: Militia Street, Mango Link, Tema, Community 20. Phones 0303 400 535 and 059 381 0182, info@thegagrafa.com. Tagline "Live Luxuriously, Stay Serenely"; place line "Community 20 · Tema".
- Word choice: guests see "apartment", never "residence". "Spintex" leaves public copy.
- No invented facts: a claim stays only if it is in the spec, on thegagrafa.com, or enforced by code. Bedrooms, bathrooms, sizes and bed types are not shown (open owner questions 11, 16); `size_sqm` and `amenities` render only when staff have filled them in.
- Photos: 897 px photos only in smaller frames, never full-bleed. Excluded: 2560 px WhatsApp images, safari/animal photos, 2018/2021 images, the Wellness page.
- Guests never see a room number on the public site.
- Down payment selected by default, or pay in full. Balance wording: "due by arrival". Prices shown in USD, charged in GHS at the Settings rate.
- Keep the real logo; it is never replaced with a typed name.
- CLAUDE.md rules apply (env helpers, `formatMoney` / `formatDate`, `actions.ts` exports, `startTransition` returning void). Motion: 500-900 ms ease-out, transform/opacity only, `prefers-reduced-motion` fallback. Targets: LCP < 2.5 s, CLS < 0.1, contrast 4.5:1, touch targets 44 px.
- Gate before any push: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run check:imports`, `npm run build`. Commit locally per task on `redesign`. The owner OKs the push. Nothing merges to `main` (Phases 3 and 4 must land first).

## Review Focus

1. A hand-edited or stale `/booking` link (unknown slug, check-out before check-in, past dates, `pay=xyz`, `guests=99`): the page opens on step 1 with safe values and never crashes (Task 6, `parseBookingParams` tests).
2. Deposit off, a total too small to split, or the exchange rate missing: the panel and checkout show only what can really be charged, and booking is paused with a clear note when the rate is missing (Task 6, `paymentSummary` tests and manual check).
3. The chosen type sells out between the panel and checkout: the guest lands on step 1 with a message, not on a form with no apartment (Task 6, Step 7).
4. A type with no photos, or an empty units table: the page shows a real Gagrafa photo or the intentional empty state, never stock imagery (Task 4 tests, Task 1 guard test).
5. Slow networks and reduced motion: only the first slide loads, nothing auto-advances, and the page does not shift when photos appear (Task 3 and Task 9 checks).

---

### Task 1: Real photos, seed data and design tokens

**Files:**
- Create: `public/photos/` (`hero-1.jpg` … `hero-4.jpg`, `aerial.jpg`, `pool.jpg`, `gym.jpg`, `lounge.jpg`, `welcome-1.jpg`, `welcome-2.jpg`)
- Create: `public/apartments/<slug>/1.jpg` … one folder per type
- Create: `src/lib/property.ts`
- Create: `src/lib/public-copy.test.ts`
- Modify: `supabase/reset-and-seed.sql`, `src/lib/booking/seed-sql.test.ts`
- Modify: `src/lib/site-settings.ts:20-29`, `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx:11-15`, `next.config.mjs:43-51`

**Interfaces:**
- Produces: in `src/lib/property.ts`: `APARTMENT_FALLBACK_IMAGE = "/photos/lounge.jpg"`; `HERO_SLIDES: { src: string; alt: string; position: string }[]`; `BUILDING_AMENITIES: { name: string; src: string; alt: string }[]` (Pool side, Gym, Lounge); `ON_REQUEST = ["Breakfast", "Airport transfer"]`.
- Produces (CSS): `.eyebrow`, `.link-underline`, `.panel`; token `champagne.ink`.

Photo sources (prefix `https://thegagrafa.com/wp-content/uploads/`). Lists are already de-duplicated (`1-2` = `1-1`, `1-9` = `1-8`, exact copies); `2025/01/hall4.jpg` is gone, so Executive uses `hall2`.

| Target | Sources, in order |
|---|---|
| `public/photos/hero-1…4` | `2025/05/Gagrafa-3-scaled`, `Gagrafa-1-scaled`, `Gagrafa-2-scaled`, `Gagrafa-139-scaled` |
| `aerial`, `pool`, `gym`, `lounge` | `2025/05/a-1`, `Gagrafa-1-scaled`, `1-5`, `5-1` |
| `welcome-1`, `welcome-2` | `2025/05/hall2`, `2-3` |
| `apartments/penthouse` | `2025/05/{2-1,1-3,3-1,5-1,4-2}` |
| `apartments/two-bed-executive` | `2025/05/{1-1,2,3,4-1,5}` |
| `apartments/one-bed-executive` | `2025/01/{bed,hall1,hall3,hall2}` |
| `apartments/one-bed-standard` | `2025/01/{bed-1,1,2,3,5}` |
| `apartments/studio` | `2025/05/{bed-2,1-8,2-3,4-4}` |

- [ ] **Step 1: Download the photos and look at every one**

Open each file. Remove any that shows the wrong room, Mole Motel or theme stock, and tell the owner. Write `alt` text from what the photo shows (`HERO_SLIDES`, `BUILDING_AMENITIES`). Set each slide's `position` from the crop at 375 px portrait.

- [ ] **Step 2: Write failing seed tests in `seed-sql.test.ts`**

```ts
it("gives every type its real photos, and each file exists", async () => {
  const { rows } = await db.query<{ slug: string; images: string[] }>("select slug, images from units");
  for (const u of rows) {
    expect(u.images.length).toBeGreaterThanOrEqual(4);
    for (const src of u.images) {
      expect(src.startsWith(`/apartments/${u.slug}/`)).toBe(true);
      expect(existsSync(join(process.cwd(), "public", src))).toBe(true);
    }
  }
});

it("no two photos in a gallery are the same file", async () => { /* hash each file with node:crypto; expect a Set the same size */ });

it("gives every type the old-site description", async () => {
  const { rows } = await db.query<{ description: string }>("select description from units");
  for (const u of rows) expect(u.description).toContain("relaxing atmosphere of a home");
});

it("sets the real address and contacts", async () => {
  const { rows } = await db.query("select address, contact_phone, contact_email from property_settings");
  expect(rows).toEqual([{
    address: "Militia Street, Mango Link, Tema, Community 20",
    contact_phone: "0303 400 535 / 059 381 0182",
    contact_email: "info@thegagrafa.com",
  }]);
});
```

Run `npx vitest run src/lib/booking/seed-sql.test.ts`. Expected: the four new tests FAIL.

- [ ] **Step 3: Update `reset-and-seed.sql`**

Add `description` and `images` to the unit inserts. Description, for every type: "The Gagrafa combines the elegance of a luxury hotel with the cozy, relaxing atmosphere of a home. A serene escape for business, leisure or a quick getaway, a short drive from the city's business district." `short_description`: null. Extend the final `update property_settings` with the three contact values and `reception_hours = ''`. Fix the header comment (it no longer keeps every Setting) and remove "added in Phase 2".

- [ ] **Step 4: Update fallbacks and design tokens**

- `site-settings.ts` DEFAULTS: the real address, `contact_email: "info@thegagrafa.com"`, `reception_hours: ""` (the 24/7 claim is unconfirmed).
- `tailwind.config.ts`: match the approved mockups: navy `#14213D`, champagne `#C9A96E`, ivory `#FAF7F2`, sand `#EDE6DA`. Add `champagne.ink: "#7F6132"` for small text on ivory and sand, because plain champagne fails 4.5:1 there.
- `globals.css`: `.eyebrow` (`text-[0.7rem] uppercase tracking-[0.25em] text-champagne-ink`), `.link-underline` (uppercase, tracked, `border-b border-champagne pb-0.5`), `.panel` (`border border-sand bg-white`). Square the three `.btn-*` classes and make them uppercase and tracked, as in the mockups.
- `layout.tsx`: add Playfair weight `"400"`.
- `next.config.mjs`: add the week-long cache for `/photos/:path*` and `/apartments/:path*`.

- [ ] **Step 5: Write `src/lib/public-copy.test.ts` (guard, expected to fail until Task 8)**

```ts
// Scans src/app (except admin and api), src/components/site, src/lib/notify, src/lib/property.ts, src/lib/site-settings.ts.
const BANNED = [/residence/i, /spintex/i, /images\.unsplash\.com/, /infinity pool/i, /backup power/i, /secure parking/i];
it.each(files)("%s has no retired words or invented claims", (file) => {
  for (const word of BANNED) expect(readFileSync(file, "utf8")).not.toMatch(word);
});
```

Mark it `describe.skip` for now; Task 8 removes the skip.

- [ ] **Step 6: Run the seed tests, then commit**

`npx vitest run src/lib/booking/seed-sql.test.ts`, expected PASS. `npx tsc --noEmit`, expected clean. Commit: `Real photos, seed data and palette for the public site`.

---

### Task 2: Logo, header and footer

**Files:**
- Create: `src/components/site/Logo.tsx`
- Modify: `src/components/site/SiteHeader.tsx`, `src/components/site/SiteFooter.tsx`, `src/app/icon.svg` (only if the mark reads at 32 px)

**Interfaces:**
- Produces: `Logo({ className }: { className?: string })`: inline SVG with `fill="currentColor"`, `role="img"`, `aria-label="The Gagrafa"`. White on photos, navy on light headers, by inheriting text colour.

- [ ] **Step 1: Trace the logo**

Work in the scratchpad, not the repo: upscale `logo-1.png` (266 × 93 px) 8× with `sharp`, trace it with `potrace` installed there, then simplify the paths. Show the result at 400 px beside the original, and redraw by hand any letter that wobbles. The mark must read "THE" between two rules, above "gagrafa". Do not add `potrace` to `package.json`.

- [ ] **Step 2: Rewrite the header to the mockup**

Three columns on every width: Menu (icon plus the word, 44 px target) on the left, `Logo` in the centre, a `Book` button on the right. Keep the transparent-over-homepage and solid-after-80 px behaviour, and the menu's Escape handling, scroll lock and close-on-navigate. The full-screen menu opens on every width, with links Apartments, Tour, About, Contact, Guest Portal, plus the place line. Remove the desktop nav row.

- [ ] **Step 3: Update the footer**

Use `Logo` in place of the typed name and "Apartments" as the link label. Task 3 switches the phone line to `tel:` links.

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit`. Check at 375 and 1280 px: logo sharp on a photo and on ivory, menu reachable by keyboard, focus visible. Commit: `Real logo and the new header`.

---

### Task 3: Book / Call button and hero slideshow

**Files:**
- Create: `src/lib/contact-links.ts`, `src/lib/contact-links.test.ts`
- Create: `src/components/site/HeroSlideshow.tsx`
- Modify: `src/components/site/FloatingBookButton.tsx`, `src/components/site/SiteFooter.tsx`, `src/app/layout.tsx`, `src/app/page.tsx`, `next.config.mjs`
- Delete: `src/components/site/HeroVideo.tsx`, `src/lib/hooks/useParallax.ts`, `public/video/*`

**Interfaces:**
- Consumes: `HERO_SLIDES` (Task 1).
- Produces: `phoneNumbers(raw: string): string[]`; `telHref(phone: string): string | null`; `<HeroSlideshow />`; `<FloatingBookButton phone={string | null} />`.

- [ ] **Step 1: Write failing tests**

```ts
it("splits Settings phone text", () => {
  expect(phoneNumbers("0303 400 535 / 059 381 0182")).toEqual(["0303 400 535", "059 381 0182"]);
  expect(phoneNumbers("0303 400 535 · 059 381 0182")).toHaveLength(2);
  expect(phoneNumbers("")).toEqual([]);
});
it("builds international tel links", () => {
  expect(telHref("0303 400 535")).toBe("tel:+233303400535");
  expect(telHref("+233 59 381 0182")).toBe("tel:+233593810182");
  expect(telHref("call us")).toBeNull();
});
```

Run `npx vitest run src/lib/contact-links.test.ts`. Expected: FAIL.

- [ ] **Step 2: Implement `contact-links.ts`, run, expect PASS**

- [ ] **Step 3: Rewrite `FloatingBookButton` as the round pair**

Two 56 px navy circles, bottom right, labelled Book and Call, on phones and desktop. Call is a `tel:` link to the first number and is left out when there is none. Book goes to `/booking`, or to `#reserve` on `/units/[slug]`. Keep `HIDDEN_ON`, `data-hide-floating-book`, the appear-after-first-screen rule and the reduced-motion fallback. `layout.tsx` becomes async to pass `telHref(phoneNumbers(settings.contact_phone)[0] ?? "")`. The footer's phone line uses the same helpers.

- [ ] **Step 4: Build `HeroSlideshow`**

Keeps the `-mt-20 h-[100svh] min-h-[600px]` frame and the gradients. The first slide is `next/image` with `priority`; it is the LCP. Other slides mount after window load and idle, and only when `shouldAdvance()` is true (the old `shouldPlayVideo` rules: no reduced motion, no Save-Data, not 2g/3g). Crossfade opacity over 900 ms every 6 s, and pause while the tab is hidden. Text: h1 "Live Luxuriously, Stay Serenely" with the two-line sizing from `HeroVideo.tsx:121-126` (prevents CLS), then "Community 20 · Tema". Dots are real buttons with 44 px targets and labels ("Show photo 2 of 4"); pressing one stops auto-advance. With a single slide showing, no dots.

- [ ] **Step 5: Delete the video code and files; verify; commit**

Swap `HeroVideo` for `HeroSlideshow` in `src/app/page.tsx` (the rest of that page changes in Task 4) and remove the `/video` cache rule from `next.config.mjs`. Run `npm test`, `npx tsc --noEmit`, `npm run check:imports`. Check reduced motion and Chrome's Save-Data at 375 px. Commit: `Photo slideshow and round Book and Call buttons`.

---

### Task 4: Homepage and apartment list

**Files:**
- Create: `src/lib/apartment-facts.ts`, `src/lib/apartment-facts.test.ts`
- Create: `src/components/site/ApartmentRow.tsx`, `src/components/site/AmenityPhotos.tsx`, `src/components/site/FindUsBand.tsx`
- Modify: `src/app/page.tsx`, `src/app/units/page.tsx`, `src/app/units/loading.tsx`
- Delete: `src/components/site/UnitCard.tsx`

**Interfaces:**
- Consumes: `BUILDING_AMENITIES`, `ON_REQUEST`, `APARTMENT_FALLBACK_IMAGE`, `phoneNumbers`, `telHref`.
- Produces: `coverImage(unit: Pick<Unit, "images">): string`; `unitFacts(unit: Pick<Unit, "max_guests" | "monthly_price" | "size_sqm">): string[]`; `<ApartmentRow unit currency flip />`; `<AmenityPhotos />`; `<FindUsBand settings />`.

- [ ] **Step 1: Write failing tests**

```ts
it("describes guests and how long you can stay", () => {
  expect(unitFacts({ max_guests: 2, monthly_price: 2500, size_sqm: null })).toEqual(["Up to 2 adults", "A night or a month"]);
  expect(unitFacts({ max_guests: 2, monthly_price: null, size_sqm: null })).toEqual(["Up to 2 adults", "By the night"]);
  expect(unitFacts({ max_guests: 1, monthly_price: null, size_sqm: 40 })).toEqual(["1 adult", "By the night", "40 m²"]);
});
it("falls back to a real photo, never stock", () => {
  expect(coverImage({ images: [] })).toBe("/photos/lounge.jpg");
  expect(coverImage({ images: ["/apartments/studio/1.jpg"] })).toBe("/apartments/studio/1.jpg");
});
```

Run `npx vitest run src/lib/apartment-facts.test.ts`. Expected: FAIL.

- [ ] **Step 2: Implement `apartment-facts.ts`, run, expect PASS**

- [ ] **Step 3: Build the three components**

- `ApartmentRow`: alternating `grid` of photo (1.4fr) and text (1fr), image side set by `flip`; on phones photo first. Name, `unitFacts`, prices as "$300 a night · $2,500 a month" (nightly only when no monthly price), "Explore" `.link-underline` to `/units/[slug]`. Slow image zoom on hover.
- `AmenityPhotos`: three photos with captions, from `BUILDING_AMENITIES`, then "On request: breakfast · airport transfer" from `ON_REQUEST`.
- `FindUsBand`: `aerial.jpg` under a navy overlay; eyebrow "Find us", the address, numbers as `tel:` links, email as `mailto:`.

- [ ] **Step 4: Rewrite `src/app/page.tsx` to direction A**

Order: `HeroSlideshow`; welcome (eyebrow "Welcome to The Gagrafa", h2 "The elegance of a hotel, the ease of a home", collage of `welcome-1`, the text "Fully furnished apartments for business, leisure or a quick getaway. A serene escape, a short drive from the city's business district." plus an "About us" link, then `welcome-2`); sand section, eyebrow "Our apartments", h2 "Five ways to stay", all active units as `ApartmentRow` (drop `.limit(3)`), keeping `EmptyState`; `AmenityPhotos`; `FindUsBand`. Remove the amenities array and the testimonial section with its fallback quote. Wrap sections in `Reveal`.

- [ ] **Step 5: Rewrite `src/app/units/page.tsx`**

Title "Our apartments" over the same `ApartmentRow` list; update `units/loading.tsx` to match the row shape. Delete `UnitCard.tsx`.

- [ ] **Step 6: Verify and commit**

`npx vitest run src/lib/apartment-facts.test.ts`, `npx tsc --noEmit`, `npm run check:imports`. Check at 375 and 1280 px, including the empty units state. Commit: `Homepage direction A and the apartment rows`.

---

### Task 5: Apartment page

**Files:**
- Modify: `src/app/units/[slug]/page.tsx`, `src/app/units/[slug]/loading.tsx`, `src/components/site/UnitGallery.tsx`
- Create: `src/components/site/OtherApartments.tsx`

**Interfaces:**
- Consumes: `unitFacts`, `coverImage`, `AmenityPhotos`, `CANCELLATION_POLICY`.
- Produces: `<OtherApartments units currency />`; an element `id="reserve"` around the booking panel.

- [ ] **Step 1: Rebuild `UnitGallery` as one large plus four**

`grid-cols-[2fr_1fr_1fr]`, two rows, on `md`+; the large photo spans both rows. Handles 1 to 5+ photos with no empty cells (4 photos: three small, last one spanning two). Button "All photos" on the last tile opens the existing `Lightbox`. On phones: the large photo plus the button. Empty list: `APARTMENT_FALLBACK_IMAGE`. `sizes`: `(min-width: 768px) 50vw, 100vw` for the large one, `25vw` for the rest.

- [ ] **Step 2: Rewrite the page body to the mockup**

Also fetch the other active types. Left column: breadcrumb Home / Apartments / name; h1; prices line; `unitFacts` plus "Pool · Gym · Lounge" as labelled facts; description; "In the apartment" list only when `unit.amenities` is non-empty; "At the building" with `AmenityPhotos`; "Good to know" with `CANCELLATION_POLICY` and the address linked to Google Maps. Right column: the sticky panel inside `id="reserve"` (`lg:sticky lg:top-28`, `scroll-mt-24`). Below: `OtherApartments` on sand, the other active types as four small cards. Replace the bed/bath/size `Stat` grid.

- [ ] **Step 3: Fix JSON-LD and metadata for local photo paths**

`image: new URL(coverImage(unit), siteUrl()).href`. Prices from the unit, currency from Settings; keep `generateMetadata`'s Open Graph image.

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit`. Check the Executive (4 photos), Studio (4, no monthly price) and Penthouse at 375 and 1280 px, Lightbox by keyboard, and no 897 px photo full-bleed. Commit: `The apartment page`.

---

### Task 6: Booking panel and checkout handoff

**Files:**
- Create: `src/lib/booking/payment-summary.ts`, `src/lib/booking/payment-summary.test.ts`
- Create: `src/lib/booking/booking-link.ts`, `src/lib/booking/booking-link.test.ts`
- Create: `src/components/site/PaymentChoice.tsx`
- Modify: `src/components/site/BookingWidget.tsx`, `src/components/site/BookingFlow.tsx`, `src/components/site/UnitPicker.tsx`
- Modify: `src/app/units/[slug]/page.tsx` (pass `depositPercent` and `pricing`)

**Interfaces:**
- Consumes: `depositAmount`, `canOfferDeposit`, `toChargeAmount`, `stayDatesError`, `MIN_NIGHTS`, `checkUnitsAvailability`, `coverImage`, `unitFacts`.
- Produces:

```ts
export type PaymentOption = "full" | "deposit";
export function paymentSummary(input: { total: number; depositPercent: number; pricing: Pricing; option: PaymentOption }): {
  depositOffered: boolean; payingDeposit: boolean; deposit: number; dueNow: number; balanceLater: number;
  chargeTotal: number | null; chargeDueNow: number | null; convertsToCedis: boolean;
};
export function bookingHref(input: { slug?: string; checkIn: string; checkOut: string; guests: number; pay: PaymentOption }): string;
export function parseBookingParams(params: { get(key: string): string | null }, units: Pick<Unit, "id" | "slug" | "max_guests">[]): {
  unitId: string; checkIn: string; checkOut: string; guests: number; pay: PaymentOption; startStep: 1 | 2;
};
```

- [ ] **Step 1: Write failing `paymentSummary` tests**

Cases: USD $900 at 50% with rate 12 gives deposit 450, balance 450, chargeTotal 10800, chargeDueNow 5400, `convertsToCedis` true. Option `deposit` with percent 0: not offered, `dueNow` 900. Total 0: not offered. Rate missing (`toChargeAmount` null): `chargeDueNow` null. GHS pricing: `convertsToCedis` false. 45 nights Executive, total 3000: deposit 1500.

- [ ] **Step 2: Write failing `parseBookingParams` and `bookingHref` tests**

Use dates built with `addDays(toISODate(new Date()), n)`. Cases: valid link gives `startStep: 2`, `pay: "deposit"`. Missing `pay` defaults to `"deposit"`; `pay=xyz` defaults to `"deposit"`; `pay=full` stays. Unknown slug gives `unitId ""`, `startStep: 1`. `checkIn=banana` gives empty dates, `startStep: 1`. Check-out before check-in, one night, past dates, each `startStep: 1`. `guests=99` caps to `max_guests`; `guests=0` and `guests=abc` give 2. `bookingHref` output parsed back returns the same values. Without `slug`, `bookingHref` leaves out `unit`.

Run both files. Expected: FAIL.

- [ ] **Step 3: Implement both helpers, moving the logic out of `BookingFlow.tsx:73-84`**

`parseGuests` moves too. `startStep` is 2 only when the unit is known, both dates are well-formed and `stayDatesError` returns null. Run both files, expect PASS.

- [ ] **Step 4: Rebuild `BookingWidget` as the mockup's panel**

Props: `unit`, `currency`, `depositPercent`, `pricing`. Heading `Reserve the ${unit.name}`. Dates, guests (select from 1 to `max_guests`), the price line ("$300 × 3 nights" or "Monthly rate, 45 nights"), then two `PaymentChoice` options: "Down payment · $450" (selected) with "Secures your dates. The remaining $450 is due by arrival.", and "Pay in full · $900". Button "Continue to payment" goes to `bookingHref`. Note under it: "Card or Mobile Money via Paystack · charged in cedis". `PaymentChoice` moves out of `BookingFlow.tsx:448-475` into its own file so both screens share it.

- [ ] **Step 5: Add live availability to the panel**

Once dates are valid (nights ≥ `MIN_NIGHTS`), call `checkUnitsAvailability` with the same cancelled-flag pattern as `BookingFlow.tsx:104-129`. When `availability[unit.id] === false`: disable the button, show "Not available for these dates" and a link "See other apartments" to `bookingHref` without `slug`. When the check fails: keep the button on and show "We'll confirm availability at payment" (fail open, as `BookingFlow` does). Show the 2-night minimum when the stay is too short.

- [ ] **Step 6: Update `BookingFlow`**

Initial state comes from `parseBookingParams`, so a panel visitor lands on step 2 with their choice intact. `paymentOption` starts from `pay`. Use `paymentSummary`. Replace raw `{checkIn} → {checkOut}` with `formatDate`. Wording: "Apartment" throughout and "due by arrival". Replace `FALLBACK_IMAGE` with `coverImage`, here and in `UnitPicker`.

- [ ] **Step 7: Handle a sold-out selection**

In the drop-selection effect (`BookingFlow.tsx:132-139`), also `setStep(1)`, so the toast and picker explain what happened. `getUnitBlockReason` stays as it is.

- [ ] **Step 8: Trim `UnitPicker`**

Replace bed/bath stats with `unitFacts`, remove the repeated description and its "Full details" toggle, and rename its strings to "apartment". Nightly price stays; add the monthly price when there is one.

- [ ] **Step 9: Verify and commit**

`npm test`, `npx tsc --noEmit`, `npm run check:imports`. On the preview database with Paystack test keys: panel to step 2 to checkout, for deposit and for full; 30 nights shows the monthly line; deposit 0 in Settings shows full only. Commit: `Booking panel with down payment, availability and checkout handoff`.

---

### Task 7: About, Tour, Contact, FAQ, Terms and the rest of the copy

**Files:**
- Modify: `src/app/about/page.tsx`, `src/app/tour/page.tsx`, `src/app/contact/page.tsx`, `src/app/faq/page.tsx`, `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, `src/app/not-found.tsx`, `src/app/booking/cancelled/page.tsx`, `src/app/layout.tsx`, `src/app/opengraph-image.alt.txt`, `src/app/units/[slug]/loading.tsx`, `src/lib/tour-photos.ts`

- [ ] **Step 1: Rewrite About from the old-site text**

Banner: `hero-4.jpg` (2560 px; the current 897 px banner breaks the photo rule). Body: the `about-us` page text from thegagrafa.com, lightly tidied ("Welcome to The Gagrafa, where modern living meets comfort and convenience…", then the thoughtfully-designed and tranquillity paragraphs). Remove the "Our story", pillars and neighbourhood sections (their 24/7 staff, backup power and Accra Mall claims are unconfirmed).

- [ ] **Step 2: Fix Tour**

`TOUR_HERO` becomes `hero-1.jpg`, with the old hero kept in `INTERIOR_PHOTOS`. Replace "residence" and "Spintex" wording. The neighbourhood strip stays conditional on uploaded photos, retitled "Around Community 20" and without the distance claim. Remove `isPlaceholder`: the seed no longer has stock photos.

- [ ] **Step 3: Update Contact, FAQ, Terms, Privacy and metadata**

- Contact: details from Settings (already filtered when blank), numbers as `tel:` links.
- FAQ, keep only what is true: check-in 2 PM / check-out 11 AM; cancellation; payment methods; down payment ("pay the rest by arrival"); 2-night minimum and monthly rate; airport transfer and breakfast on request. Remove parking, pets, Wi-Fi speed and the early check-in promise.
- Terms: section 3 reads that a booking is secured by a down payment or full payment, with the balance due by arrival. In House Rules keep only the occupancy and damage lines; smoking, quiet hours and pets wait for owner question 13. Update `LAST_UPDATED`.
- Layout metadata and JSON-LD: "serviced apartments in Tema, Community 20"; `streetAddress: "Militia Street, Mango Link"`, `addressLocality: "Tema"`. Drop "signature penthouse".

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit`. Read each page once at 375 px. Commit: `Public pages carry only real facts`.

---

### Task 8: Finish the rename and refresh the docs

**Files:**
- Modify: `src/lib/public-copy.test.ts`, `DESIGN.md`, `CLAUDE.md`
- Modify: whichever guest-facing strings the guard finds (expected: `src/lib/validations.ts`, `src/lib/booking/stay-limits.ts`, `src/lib/notify/email.ts`, `src/app/booking/actions.ts`, `src/app/portal/[code]/page.tsx`, `src/app/api/cron/reminders/route.ts`, `src/lib/payments/booking-payment.ts`)

- [ ] **Step 1: Remove `describe.skip` from the guard and run it**

`npx vitest run src/lib/public-copy.test.ts`. Expected: FAIL listing what is left.

- [ ] **Step 2: Fix each hit, and widen the guard with those guest-facing files**

Change strings only, never logic. Tests that assert old wording (`stay-limits.test.ts`, `release-hold.test.ts`) change with them. Admin pages keep their wording until Phase 3. Run the guard and `npm test`, expect PASS.

- [ ] **Step 3: Update the docs**

`DESIGN.md`: replace the video hero and old section list with direction A, and note the apartment page. `CLAUDE.md`: Tema wording, real seed data and photo locations, and remove the finished homepage items from Pending. Commit: `Apartment wording everywhere guests read, and docs`.

---

### Task 9: Gate and visual checks

- [ ] **Step 1: Run the full gate**

`npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run check:imports`, `npm run build`. Expected: all clean. On Windows, follow the `.next` and `.tsbuildinfo` notes in CLAUDE.md and memory.

- [ ] **Step 2: Check against the mockups in a real browser**

Needs a database with all migrations and `reset-and-seed.sql` (the separate preview project; never the live one). At 375 and 1280 px: home, all five apartment pages, booking, Tour, About, Contact, FAQ, Terms, 404. Compare with the mockups. Confirm reduced motion, keyboard use and no console or CSP errors.

- [ ] **Step 3: Measure**

Lighthouse mobile on home and one apartment page. Targets: performance 85+, accessibility 95+, LCP < 2.5 s, CLS < 0.1. Fix what fails.

- [ ] **Step 4: Report for the push**

List only the changed files, the owner's steps (run `reset-and-seed.sql` on the preview project), and ask whether to push `redesign` for the preview. After the push, open the preview URL and repeat the home and booking checks.
