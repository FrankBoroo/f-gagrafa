---
name: gagrafa-frontend-design
description: Use when building or changing any public-facing UI for The Gagrafa (homepage, units, booking flow, tour). Enforces the luxury visual language, motion rules, performance budget and accessibility.
---

# Gagrafa frontend design

Read `DESIGN.md` first for the homepage specifics. This skill covers rules for all UI.

## Look
- Palette tokens only (navy, champagne, ivory, sand) from `tailwind.config.ts`. Never hard-code hex values in components.
- Playfair Display for headings (large, light, tight tracking); Inter for body and UI.
- Generous whitespace, soft shadows, thin champagne rules. One accent per section; avoid visual noise.
- Empty states and skeleton loaders must look intentional, not like errors.

## Components
- Reuse `components/ui` primitives. Add a new primitive only if two places need it.
- Server components by default; add `"use client"` only for state, effects or browser APIs, and keep client islands small.
- Forms: react-hook-form + zod schema from `lib/validations.ts` (same schema server-side).
- Toasts via sonner. Destructive actions need a confirmation dialog.

## Motion
- 500-900 ms, ease-out, fade/translate only. Animate `transform` and `opacity`, never layout properties.
- Every animation has a `prefers-reduced-motion` fallback (no motion, content visible).
- Callbacks passed to `startTransition(async () => ...)` return void: call `toast.error(...)` then `return;`.

## Performance (Ghanaian mobile networks)
- Images through `next/image` with correct `sizes`; hero and above-the-fold images `priority`; everything else lazy.
- No heavy client libraries for effects; plain CSS plus a tiny hook is the default.
- Video: muted, looped, `playsInline`, poster image, pause off-screen, skip on data saver.
- Targets: LCP < 2.5 s on throttled 4G, CLS < 0.1.

## Accessibility
- Contrast 4.5:1 for text; visible focus rings; keyboard-operable menus and dialogs.
- Meaningful `alt` on content images; decorative media `aria-hidden`.
- Touch targets at least 44 px.

## Hydration safety
- No locale-dependent date or number formatting during render. Use fixed-format helpers (`.slice(0, 10)` or `lib` helpers).
- No `Math.random()` or `Date.now()` in render output.

## Done means
`npx tsc --noEmit` and `npm run build` pass, checked at 375 px and 1280 px widths, reduced-motion checked.
