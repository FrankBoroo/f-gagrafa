"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface LightboxImage {
  src: string;
  alt: string;
  caption?: string;
}

// Full-screen photo viewer. Keyboard: Esc closes, ←/→ move. Touch: swipe left/right.
// `index` is the open photo (null = closed); the parent owns it so any grid can open it.
export function Lightbox({
  images, index, onClose, onIndexChange,
}: {
  images: LightboxImage[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);
  const count = images.length;
  const open = index !== null && count > 0;

  // Lock page scroll while open, move focus into the viewer, and put it back afterwards.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const current = index as number;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndexChange((current + 1) % count);
      else if (e.key === "ArrowLeft") onIndexChange((current - 1 + count) % count);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, count, onClose, onIndexChange]);

  if (!open) return null;
  const current = index as number;
  const image = images[current];

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return; // a tap or a tiny drag, not a swipe
    onIndexChange(dx < 0 ? (current + 1) % count : (current - 1 + count) % count);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-navy/95"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center justify-between px-4 py-3 text-ivory">
        <span className="text-sm text-ivory/70">{current + 1} / {count}</span>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close photo viewer" className="rounded-full p-2 hover:bg-ivory/10">
          <X size={24} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1" onClick={onClose}>
        <Image key={image.src} src={image.src} alt={image.alt} fill sizes="100vw" priority className="object-contain" />
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => onIndexChange((current - 1 + count) % count)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-navy/60 p-2 text-ivory hover:bg-navy"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => onIndexChange((current + 1) % count)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-navy/60 p-2 text-ivory hover:bg-navy"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}

      {image.caption && <p className="px-4 py-4 text-center text-sm text-ivory/80">{image.caption}</p>}
    </div>
  );
}
