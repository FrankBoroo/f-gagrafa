"use client";

import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import Link from "next/link";
import { getImageProps } from "next/image";
import { ChevronDown } from "lucide-react";
import { useParallax } from "@/lib/hooks/useParallax";

// 5-second loop made from three photos of The Gagrafa (building, lounge, living room).
// Landscape for desktop, portrait for phones; WebM first, MP4 for Safari.
const VIDEO = {
  desktop: { webm: "/video/hero-desktop.webm", mp4: "/video/hero-desktop.mp4" },
  mobile: { webm: "/video/hero-mobile.webm", mp4: "/video/hero-mobile.mp4" },
};

const POSTER_ALT = "The Gagrafa building in Spintex, Accra";
const common = { alt: POSTER_ALT, fill: true, priority: true, sizes: "100vw" } as const;
const { props: { srcSet: mobilePoster } } = getImageProps({ ...common, src: "/video/hero-poster-mobile.jpg" });
const { props: desktopPoster } = getImageProps({ ...common, src: "/video/hero-poster.jpg" });

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

// Video only when it can play quietly and cheaply; otherwise the poster is the hero.
function shouldPlayVideo(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType && ["slow-2g", "2g", "3g"].includes(connection.effectiveType)) return false;
  return true;
}

export function HeroVideo() {
  const section = useRef<HTMLElement>(null);
  const media = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [sources, setSources] = useState<{ webm: string; mp4: string } | null>(null);
  const [playing, setPlaying] = useState(false);

  // The <picture> sits deep in the streamed body; announce each poster in <head> so the LCP
  // image starts loading with the CSS. Media-scoped, so a device fetches only its own poster.
  preload(desktopPoster.src, { as: "image", imageSrcSet: mobilePoster, imageSizes: "100vw", fetchPriority: "high", media: "(max-width: 767px)" });
  preload(desktopPoster.src, { as: "image", imageSrcSet: desktopPoster.srcSet, imageSizes: "100vw", fetchPriority: "high", media: "(min-width: 768px)" });

  useParallax(section, media, content);

  // Decide after mount (needs the browser), so server and client render the same poster.
  // Wait for the page to finish loading and go idle first: the poster is the LCP, and the
  // video shouldn't compete with scripts and images on a slow connection.
  useEffect(() => {
    if (!shouldPlayVideo()) return;
    let idle = 0;
    const start = () => {
      const run = () => setSources(window.matchMedia("(max-width: 767px)").matches ? VIDEO.mobile : VIDEO.desktop);
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

  // Play only while the hero is on screen, to save battery and data.
  useEffect(() => {
    const el = video.current;
    if (!sources || !el || !section.current) return;
    const observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting) el.play().catch(() => undefined); // blocked autoplay: poster stays
      else el.pause();
    });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [sources]);

  return (
    <section
      ref={section}
      className="relative -mt-20 flex h-[100svh] min-h-[600px] items-end overflow-hidden bg-navy"
    >
      {/* Over-sized so the parallax never shows an edge. */}
      <div ref={media} className="absolute inset-x-0 -bottom-[10%] -top-[10%] will-change-transform" aria-hidden="true">
        <picture>
          <source media="(max-width: 767px)" srcSet={mobilePoster} />
          {/* Art-directed poster (portrait on phones) via getImageProps, as the Next docs show;
              decorative here, the text below carries the meaning. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...desktopPoster} alt="" fetchPriority="high" loading="eager" className="object-cover object-[45%_50%]" />
        </picture>
        {sources && (
          <video
            ref={video}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            onPlaying={() => setPlaying(true)}
            onError={() => setPlaying(false)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${
              playing ? "opacity-100" : "opacity-0"
            }`}
          >
            <source src={sources.webm} type="video/webm" />
            <source src={sources.mp4} type="video/mp4" />
          </video>
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/40 to-navy/25" aria-hidden="true" />
      {/* Extra shade under the see-through header so its links stay legible on bright frames. */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-navy/60 to-transparent" aria-hidden="true" />

      <div ref={content} className="container-gagrafa relative z-10 pb-20 text-ivory md:pb-28">
        <p className="text-xs uppercase tracking-[0.3em] text-champagne-light">Spintex, Accra</p>
        {/* Two fixed lines, sized to fit the phone width (the longer line is about 8 em wide), so
            the heading never wraps differently when Playfair replaces the fallback font (CLS). */}
        <h1 className="mt-6 max-w-3xl text-[min(3rem,calc((100vw_-_3rem)/8))] leading-[1.05] md:text-7xl">
          <span className="block whitespace-nowrap">Live Luxuriously,</span>
          <span className="block whitespace-nowrap">Stay Serenely.</span>
        </h1>
        <p className="mt-6 max-w-md text-lg text-ivory/80">
          Serviced residences on Community 20, where quiet design and attentive service meet, for a
          night or a season.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link href="/booking" className="btn-gold">Book Your Stay</Link>
          <Link href="/units" className="btn-secondary border-ivory/30 text-ivory hover:border-ivory/60 hover:bg-ivory/10">
            Explore residences
          </Link>
        </div>
      </div>

      <a
        href="#welcome"
        aria-label="Scroll to learn more"
        className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 text-ivory/60 transition-colors hover:text-ivory md:block"
      >
        <ChevronDown size={28} className="animate-pulse motion-reduce:animate-none" />
      </a>
    </section>
  );
}
