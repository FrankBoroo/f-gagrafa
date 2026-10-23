"use client";

import { useEffect, type RefObject } from "react";

// Scroll-linked parallax for a hero (DESIGN.md): the media layer moves slower than the page
// and the text drifts up and fades. One passive scroll listener, one rAF per frame, transform
// and opacity only. Off with reduced motion, and once the hero is scrolled out of view.
export function useParallax(
  section: RefObject<HTMLElement | null>,
  media: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  speed = 0.3
) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;

    const update = () => {
      const el = section.current;
      if (!el) return;
      const height = el.offsetHeight;
      const y = Math.min(Math.max(window.scrollY - el.offsetTop, 0), height);
      if (media.current) media.current.style.transform = `translate3d(0, ${(y * speed).toFixed(1)}px, 0)`;
      if (content.current) {
        content.current.style.transform = `translate3d(0, ${(-y * 0.15).toFixed(1)}px, 0)`;
        content.current.style.opacity = String(Math.max(1 - y / (height * 0.7), 0));
      }
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [section, media, content, speed]);
}
