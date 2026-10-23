# The Gagrafa: Homepage Design

Brand: luxury serviced apartments, Spintex / Community 20, Accra. "Live Luxuriously, Stay Serenely."
Feel: quiet luxury. Calm, premium, lots of whitespace, slow confident motion.

Reference: https://www.southstationresidences.com/ (a luxury residences site).

## Assumptions to confirm
The reference site could not be opened while this file was written, so only the user's stated points are confirmed:
- CONFIRMED: hero is a **5-second background video** with a **parallax scrolling effect**.
- ASSUMED (typical for luxury-residence sites, adjust after reviewing the reference): full-viewport hero, minimal transparent header that turns solid on scroll, large serif headings over generous whitespace, full-bleed imagery sections, restrained motion.
- Do not copy the reference's layout, copy, images or code. Take the *feel*; build The Gagrafa's own.

## Palette and type (existing tokens)
- Navy (primary text/dark sections), champagne (accent), ivory (page background), sand (secondary surfaces). Keep existing Tailwind tokens.
- Headings: Playfair Display, large, light weight, tight tracking. Body/UI: Inter.
- Accent used sparingly: thin champagne rules, button hover, small eyebrow labels.

## Hero (video + parallax)
Structure:
- Full viewport height (`100svh`), video fills the frame (`object-cover`), dark navy gradient overlay (about 35-55%) so text stays legible.
- Content: small eyebrow ("Spintex, Accra"), H1 with the tagline, one line of supporting copy, primary CTA "Book Your Stay" + quiet secondary link "Explore apartments". Slow scroll cue at the bottom.
- Optional quick-booking bar (check-in, check-out, guests) overlapping the hero's bottom edge.

Video spec:
- About 5 seconds, seamless loop (match first/last frame), no audio, 1080p max.
- Ship `hero.webm` (VP9/AV1) and `hero.mp4` (H.264 baseline). Target **under 2 MB** each for Ghanaian mobile networks. Also a separate smaller 720p mobile variant.
- Attributes: `autoPlay muted loop playsInline preload="metadata"` plus a `poster` image (the first frame, optimized, served via `next/image` priority) so LCP is the poster, not the video.
- Host in Supabase Storage or `/public/video`; set long cache headers.

Fallbacks (required):
- `prefers-reduced-motion: reduce` → show the poster only, no video, no parallax.
- Data saver / slow connection (`navigator.connection.saveData` or effectiveType `2g`/`3g`) → poster only.
- If the video errors or autoplay is blocked → poster stays visible; never show a broken player or controls.
- Pause the video when the hero is off-screen (IntersectionObserver) to save battery and data.

Parallax:
- Video layer moves slower than scroll: translate Y by about 0.25-0.35 × scrollY; the text layer moves slightly faster or fades/rises as you scroll.
- Implement with `requestAnimationFrame` + `transform: translate3d`, passive scroll listener; animate transform/opacity only (no layout properties). Over-size the video layer (about 120% height) so edges never show.
- Disable on touch devices if it janks, and when reduced-motion is set.
- No layout shift: reserve the hero height with CSS; never let the video change it.

## Page sections (top to bottom)
1. **Header**: transparent over the hero; solid ivory with soft shadow after about 80px. Logo left, links centre/right, "Book Your Stay" button. Mobile: full-screen menu.
2. **Hero** (above).
3. **Intro / about**: short statement in large serif, one image offset beside it, slow reveal.
4. **Featured apartments**: big image cards (Studio, 1-Bed Standard, 1-Bed Executive, 2-Bed, Penthouse), price from, guests, "View" link. Hover: slow image zoom.
5. **Amenities**: gym, pool, lounge, elevator, 24/7 reception, etc. as a calm icon grid on a sand background.
6. **Full-bleed image band** with a second parallax layer and a one-line quote.
7. **Experience / the area**: Spintex, Community 20 highlights; links to the Tour page once it exists (Plan phase 4).
8. **Testimonials**: placeholder carousel with clearly fake sample text until real reviews exist.
9. **Location + contact**: map embed, address, WhatsApp and call buttons.
10. **Footer**: navy, minimal links, legal.
11. **Floating "Book Your Stay" button** (mobile and desktop): appears after the hero leaves view, hides at the booking form and footer.

## Motion rules
- Slow and soft: 500-900 ms, ease-out. No bounce, no spin.
- Scroll reveals: fade up 16-24 px, once per element, staggered by 80-120 ms.
- Magnetic button / custom cursor / grain overlay: optional, desktop only, subtle. Cursor and grain must not cost performance or hide the native cursor on touch.
- Everything respects `prefers-reduced-motion`.

## Performance and accessibility budget
- LCP under 2.5 s on throttled 4G; CLS under 0.1; hero poster under 120 KB.
- Lighthouse mobile: performance 85+, accessibility 95+.
- All images via `next/image` with `sizes`; meaningful `alt` text.
- Text on the hero meets 4.5:1 contrast against the overlay.
- Keyboard focus visible on every control; the video has no controls and is `aria-hidden` (decorative).
- Buttons at least 44 px tall on mobile.

## Implementation notes for Claude Code
- Component: `src/components/site/HeroVideo.tsx` (client component) containing the video, poster, fallbacks and parallax hook; a small `useParallax` hook in `src/lib/hooks/`.
- Reveal helper: `Reveal.tsx` using IntersectionObserver.
- Do not use any library for this that adds more than a few KB; plain CSS + a tiny hook is enough.
- Use the `gagrafa-frontend-design` skill when building these pieces.
- Test on a real phone over mobile data before approving.
