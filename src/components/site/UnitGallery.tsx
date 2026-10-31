"use client";

import { useState } from "react";
import Image from "next/image";
import { Lightbox } from "@/components/site/Lightbox";
import { APARTMENT_FALLBACK_IMAGE } from "@/lib/property";

// How wide each small photo sits beside the large one, so no grid cell is ever left empty.
function smallTileClass(index: number, smallCount: number): string {
  if (smallCount === 1) return "md:col-span-2 md:row-span-2";
  if (smallCount === 2) return "md:col-span-2";
  if (smallCount === 3 && index === 2) return "md:col-span-2";
  return "";
}

// One large photo plus up to four on larger screens (just the large one on phones).
// Any photo, or "All photos", opens the full viewer.
export function UnitGallery({ images, name }: { images: string[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const list = images.length ? images : [APARTMENT_FALLBACK_IMAGE];
  const count = list.length;
  const slides = list.map((src, i) => ({ src, alt: `${name}, photo ${i + 1} of ${count}`, caption: name }));
  const small = list.slice(1, 5);

  function tile(i: number, className: string, sizes: string, priority = false) {
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
          sizes={sizes}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none"
        />
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="grid gap-1.5 md:h-[34rem] md:grid-cols-[2fr_1fr_1fr] md:grid-rows-2">
        {tile(0, `h-72 ${count === 1 ? "md:col-span-3" : ""} md:row-span-2 md:h-auto`, "(min-width: 768px) 50vw, 100vw", true)}
        {small.map((_, i: number) => tile(i + 1, `hidden md:block ${smallTileClass(i, small.length)}`, "25vw"))}
      </div>

      {count > 1 && (
        <button
          type="button"
          onClick={() => setOpen(0)}
          className="absolute bottom-3 right-3 min-h-11 bg-ivory px-4 py-2 text-[0.7rem] uppercase tracking-[0.15em] text-navy hover:bg-white"
        >
          All photos
        </button>
      )}

      <Lightbox images={slides} index={open} onClose={() => setOpen(null)} onIndexChange={setOpen} />
    </div>
  );
}
