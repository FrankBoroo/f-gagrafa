"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Lightbox } from "@/components/site/Lightbox";
import type { StripPhoto } from "@/lib/tour-photos";

// A full-width, sideways-scrolling row of photos at one height (like the old site's Tour strips).
// Swipe or trackpad on any device, arrow buttons too; each photo drifts slightly inside its
// frame as the strip moves (off with reduced motion). Tap a photo for the full-screen viewer.
const PARALLAX_PX = 28;

export function FilmStrip({
  id,
  eyebrow,
  title,
  description,
  photos,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  photos: StripPhoto[];
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = el.getBoundingClientRect();
    const centre = box.left + box.width / 2;
    layers.current.forEach((layer: HTMLDivElement | null) => {
      if (!layer?.parentElement) return;
      const frame = layer.parentElement.getBoundingClientRect();
      const offset = (frame.left + frame.width / 2 - centre) / box.width; // about -1 … 1
      layer.style.transform = `translate3d(${(-offset * PARALLAX_PX).toFixed(1)}px,0,0)`;
    });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [update]);

  function move(direction: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: smooth ? "smooth" : "auto" });
  }

  if (photos.length === 0) return null;

  return (
    <section id={id} className="scroll-mt-24" aria-label={title}>
      <div className="container-gagrafa flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          {eyebrow && <p className="text-xs uppercase tracking-[0.3em] text-champagne-dark">{eyebrow}</p>}
          <h2 className="mt-3 text-3xl md:text-4xl">{title}</h2>
          {description && <p className="mt-3 text-navy/60">{description}</p>}
        </div>
        {photos.length > 1 && (
          <div className="flex gap-2">
            <ArrowButton label={`Previous photos: ${title}`} disabled={atStart} onClick={() => move(-1)}>
              <ChevronLeft size={20} />
            </ArrowButton>
            <ArrowButton label={`More photos: ${title}`} disabled={atEnd} onClick={() => move(1)}>
              <ChevronRight size={20} />
            </ArrowButton>
          </div>
        )}
      </div>

      <div
        ref={scroller}
        className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-6 px-6 pb-2 md:gap-4 md:scroll-px-10 md:px-10"
      >
        {photos.map((photo: StripPhoto, i: number) => (
          <button
            key={`${photo.src}-${i}`}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`View larger: ${photo.alt}`}
            style={{ aspectRatio: photo.width && photo.height ? `${photo.width} / ${photo.height}` : "4 / 3" }}
            className="group relative h-[260px] shrink-0 snap-start overflow-hidden rounded-xl bg-sand md:h-[380px]"
          >
            <div
              ref={(node) => {
                layers.current[i] = node;
              }}
              className="absolute inset-y-0 -left-8 -right-8 will-change-transform"
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(min-width: 768px) 560px, 380px"
                className="object-cover transition-[filter] duration-700 ease-out group-hover:brightness-105"
              />
            </div>
          </button>
        ))}
      </div>

      <Lightbox
        images={photos.map((p: StripPhoto) => ({ src: p.src, alt: p.alt, caption: p.caption }))}
        index={open}
        onClose={() => setOpen(null)}
        onIndexChange={setOpen}
      />
    </section>
  );
}

function ArrowButton({
  label, disabled, onClick, children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-navy/20 text-navy transition-colors hover:border-navy/40 hover:bg-navy/5 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
