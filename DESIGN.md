# The Gagrafa: Public Site Design

Brand: luxury serviced apartments, Tema, Community 20. "Live Luxuriously, Stay Serenely."
Feel: quiet luxury. Calm, photo-led, lots of whitespace, slow confident motion. Only real facts and real photos.

The approved direction and rules are in `docs/superpowers/specs/2026-10-29-redesign-design.md` (section 7.1).

## Palette and type (existing tokens)
- Navy (primary text/dark sections), champagne (accent), ivory (page background), sand (secondary surfaces). Keep the Tailwind tokens. `champagne-ink` is for small text on ivory and sand, where plain champagne fails contrast.
- Headings: Playfair Display, large, light weight. Body/UI: Inter.
- Square corners on buttons, panels and photos. Accent used sparingly: thin champagne rules and small eyebrow labels (`.eyebrow`, `.link-underline`, `.panel` in `globals.css`).
- Photos: 2560 px ones for full-bleed; most old-site photos are 897 px, so use those only in smaller frames.

## Homepage (top to bottom)
1. **Header**: Menu left, real logo centred (`Logo.tsx`, white on photos, navy on light), Book right. Transparent over the slideshow, solid ivory after about 80px. The menu is full-screen on every width.
2. **Slideshow** (`HeroSlideshow.tsx`): full viewport, pool / building / aerial photos, tagline and "Community 20 · Tema". The first photo is the LCP. The others load after the page goes idle, and never with reduced motion, Data Saver or a slow connection.
3. **Welcome**: off-centre collage of two photos with the short welcome text.
4. **Apartments**: the five types as alternating rows with nightly and monthly prices (`ApartmentRow.tsx`).
5. **Amenities**: pool side, gym and lounge as photos, plus "on request" (`AmenityPhotos.tsx`).
6. **Find us**: navy band over the aerial photo with the address, phones and email (`FindUsBand.tsx`).
7. **Footer**: navy, minimal links.
8. **Round Book and Call buttons**: appear after the first screen and step aside at the booking panel and footer.

## Apartment page
One large photo plus four, title and prices, facts, description, the building's amenities, "Good to know" (72-hour rule, times, address), sticky booking panel (dates, guests, down payment selected or pay in full, live availability), other apartments.

## Motion rules
- Slow and soft: 500-900 ms, ease-out. No bounce, no spin.
- Scroll reveals: fade up 16-24 px, once per element, staggered by 80-120 ms.
- Everything respects `prefers-reduced-motion`.

## Performance and accessibility budget
- LCP under 2.5 s on throttled 4G; CLS under 0.1.
- Lighthouse mobile: performance 85+, accessibility 95+.
- All images via `next/image` with `sizes`; meaningful `alt` text.
- Text on the slideshow meets 4.5:1 contrast against the overlay.
- Keyboard focus visible on every control.
- Buttons at least 44 px tall on mobile.

## Implementation notes for Claude Code
- Reveal helper: `Reveal.tsx` using IntersectionObserver. Plain CSS plus a tiny hook is enough; no animation libraries.
- Use the `gagrafa-frontend-design` skill when building these pieces.
- Test on a real phone over mobile data before approving.
