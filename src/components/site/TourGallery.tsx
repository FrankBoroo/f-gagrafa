"use client";

import { useState } from "react";
import Image from "next/image";
import { Lightbox } from "@/components/site/Lightbox";

export type TourCategory = "residences" | "property" | "neighbourhood";

export interface TourPhoto {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  category: TourCategory;
}

type Filter = "all" | TourCategory;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "residences", label: "Residences" },
  { key: "property", label: "The property" },
  { key: "neighbourhood", label: "The neighbourhood" },
];

// The Tour page grid: filter by section, tap any photo for the full-screen viewer
// (arrow keys / swipe to move through whatever is currently showing).
export function TourGallery({ photos }: { photos: TourPhoto[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<number | null>(null);

  const visible = filter === "all" ? photos : photos.filter((p: TourPhoto) => p.category === filter);
  const slides = visible.map((p: TourPhoto) => ({ src: p.src, alt: p.alt, caption: p.caption }));

  function countFor(key: Filter) {
    return key === "all" ? photos.length : photos.filter((p: TourPhoto) => p.category === key).length;
  }

  if (photos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-navy/20 p-12 text-center text-navy/50">
        Our photo tour is being put together. Please check back soon.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tour sections">
        {FILTERS.filter((f) => f.key === "all" || countFor(f.key) > 0).map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              filter === f.key ? "border-navy bg-navy text-ivory" : "border-navy/20 text-navy/70 hover:border-navy/40"
            }`}
          >
            {f.label} <span className="opacity-60">{countFor(f.key)}</span>
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        {visible.map((photo: TourPhoto, i: number) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Open photo: ${photo.caption ?? photo.alt}`}
            className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-sand"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(min-width: 768px) 33vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {photo.caption && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/80 to-transparent px-3 pb-2 pt-8 text-left text-xs text-ivory">
                {photo.caption}
              </span>
            )}
          </button>
        ))}
      </div>

      <Lightbox images={slides} index={open} onClose={() => setOpen(null)} onIndexChange={setOpen} />
    </div>
  );
}
