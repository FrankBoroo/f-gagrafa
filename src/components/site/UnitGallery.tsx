"use client";

import { useState } from "react";
import Image from "next/image";
import { Lightbox } from "@/components/site/Lightbox";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267";

// Photo mosaic for a residence page: one big photo plus up to two beside it on larger
// screens (just the big one on phones). Any photo, or "View all", opens the full viewer.
export function UnitGallery({ images, name }: { images: string[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const list = images.length ? images : [FALLBACK_IMAGE];
  const count = list.length;
  const slides = list.map((src, i) => ({ src, alt: `${name} — photo ${i + 1} of ${count}`, caption: name }));

  function tile(i: number, className: string, priority = false) {
    return (
      <button
        key={list[i]}
        type="button"
        onClick={() => setOpen(i)}
        aria-label={`Open photo ${i + 1} of ${count}`}
        className={`group relative overflow-hidden bg-sand ${className}`}
      >
        <Image
          src={list[i]}
          alt={slides[i].alt}
          fill
          priority={priority}
          sizes={i === 0 ? "(min-width: 768px) 66vw, 100vw" : "33vw"}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="grid gap-2 overflow-hidden rounded-xl md:h-[26rem] md:grid-cols-3 md:grid-rows-2">
        {tile(0, `h-72 ${count === 1 ? "md:col-span-3" : "md:col-span-2"} md:row-span-2 md:h-auto`, true)}
        {count >= 2 && tile(1, `hidden md:block ${count === 2 ? "md:row-span-2" : ""}`)}
        {count >= 3 && tile(2, "hidden md:block")}
      </div>

      {count > 1 && (
        <button
          type="button"
          onClick={() => setOpen(0)}
          className="absolute bottom-3 right-3 rounded-full bg-white/90 px-4 py-2 text-xs text-navy shadow hover:bg-white"
        >
          View all {count} photos
        </button>
      )}

      <Lightbox images={slides} index={open} onClose={() => setOpen(null)} onIndexChange={setOpen} />
    </div>
  );
}
