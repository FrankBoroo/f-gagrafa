"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { HERO_SLIDES } from "@/lib/property";

const SLIDE_MS = 6000;

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

// More photos only when they can load and move quietly; otherwise the first photo is the hero.
function shouldAdvance(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType && ["slow-2g", "2g", "3g"].includes(connection.effectiveType)) return false;
  return true;
}

export function HeroSlideshow() {
  const [active, setActive] = useState(0);
  const [allLoaded, setAllLoaded] = useState(false);
  const [auto, setAuto] = useState(false);
  const count = HERO_SLIDES.length;

  // The first photo is the LCP. The others wait until the page has finished and gone idle.
  useEffect(() => {
    if (!shouldAdvance()) return;
    let idle = 0;
    const start = () => {
      const run = () => {
        setAllLoaded(true);
        setAuto(true);
      };
      idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(run, { timeout: 3000 }) : window.setTimeout(run, 1000);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);

  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive((i: number) => (i + 1) % count);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [auto, count]);

  function show(index: number) {
    setAuto(false);
    setActive(index);
  }

  return (
    <section className="relative -mt-20 flex h-[100svh] min-h-[600px] items-end justify-center overflow-hidden bg-navy">
      {HERO_SLIDES.map((slide, i: number) =>
        i === 0 || allLoaded ? (
          <Image
            key={slide.src}
            src={slide.src}
            alt={i === active ? slide.alt : ""}
            fill
            priority={i === 0}
            sizes="100vw"
            style={{ objectPosition: slide.position }}
            className={`object-cover transition-opacity duration-[900ms] ease-out motion-reduce:transition-none ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : null
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-navy/15 to-navy/25" aria-hidden="true" />
      {/* Extra shade under the see-through header so it stays legible on bright photos. */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-navy/60 to-transparent" aria-hidden="true" />

      <div className="container-gagrafa relative z-10 pb-20 text-center text-ivory md:pb-24">
        {/* Fixed line breaks, sized to the phone width (the longer line is about 8 em wide), so the
            heading never wraps differently when Playfair replaces the fallback font (CLS). */}
        <h1 className="text-[min(3rem,calc((100vw_-_3rem)/8))] font-normal leading-[1.1] md:text-6xl">
          <span className="block whitespace-nowrap lg:inline">Live Luxuriously, </span>
          <span className="block whitespace-nowrap lg:inline">Stay Serenely</span>
        </h1>
        <p className="mt-5 text-xs uppercase tracking-[0.25em] text-ivory/90">Community 20 · Tema</p>
      </div>

      {allLoaded && (
        <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center">
          {HERO_SLIDES.map((slide, i: number) => (
            <button
              key={slide.src}
              type="button"
              onClick={() => show(i)}
              aria-label={`Show photo ${i + 1} of ${count}`}
              aria-current={i === active}
              className="flex h-11 w-11 items-center justify-center"
            >
              <span className={`h-2 w-2 rounded-full transition-colors duration-500 ${i === active ? "bg-ivory" : "bg-ivory/50"}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
