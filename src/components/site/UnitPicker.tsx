"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { PriceCurrency } from "@/lib/booking/pricing";
import type { Unit } from "@/lib/types";
import { EmptyState } from "@/components/ui/EmptyState";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267";

// Why a residence can't be chosen right now, or null if it can. Shared with
// BookingFlow so it can also drop a selection that stops being valid (e.g. the
// guest raises the guest count, or changes dates to ones that are taken).
export function getUnitBlockReason(
  unit: Unit,
  guests: number,
  availability: Record<string, boolean> | null
): string | null {
  if (availability && availability[unit.id] === false) return "Unavailable for these dates";
  if (guests > unit.max_guests) return `Sleeps ${unit.max_guests} max`;
  return null;
}

export function UnitPicker({
  units, selectedId, onSelect, guests, nights, availability, currency = "GHS",
}: {
  units: Unit[];
  currency?: PriceCurrency;
  selectedId: string;
  onSelect: (id: string) => void;
  guests: number;
  nights: number;
  availability: Record<string, boolean> | null;
}) {
  if (!units.length) {
    return (
      <EmptyState
        compact
        title="No residences are open for booking right now"
        description="Get in touch and we'll help you find dates."
        action={{ href: "/contact", label: "Contact us" }}
      />
    );
  }

  return (
    // Native radio inputs inside: arrow keys, focus, and screen readers work for free.
    <fieldset className="space-y-4">
      <legend className="sr-only">Choose your residence</legend>
      {units.map((unit) => (
        <UnitOption
          key={unit.id}
          unit={unit}
          selected={unit.id === selectedId}
          onSelect={onSelect}
          blockReason={getUnitBlockReason(unit, guests, availability)}
          nights={nights}
          currency={currency}
        />
      ))}
    </fieldset>
  );
}

function UnitOption({
  unit, selected, onSelect, blockReason, nights, currency,
}: {
  unit: Unit;
  currency: PriceCurrency;
  selected: boolean;
  onSelect: (id: string) => void;
  blockReason: string | null;
  nights: number;
}) {
  const images = unit.images?.length ? unit.images : [FALLBACK_IMAGE];
  const amenities = unit.amenities ?? [];
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const blocked = blockReason !== null;
  const hasMoreDetail =
    amenities.length > 4 || Boolean(unit.description && unit.description !== unit.short_description);
  const visibleAmenities = expanded ? amenities : amenities.slice(0, 4);
  const reasonId = `unit-reason-${unit.id}`;

  const stats = [
    `${unit.max_guests} guest${unit.max_guests === 1 ? "" : "s"}`,
    unit.bedrooms === 0 ? "Studio" : `${unit.bedrooms} bedroom${unit.bedrooms === 1 ? "" : "s"}`,
    `${unit.bathrooms} bath`,
    unit.size_sqm ? `${unit.size_sqm} m²` : null,
  ].filter(Boolean);

  // Buttons live inside the <label>; stop them from toggling the radio.
  function stopAnd(e: React.MouseEvent, fn: () => void) {
    e.preventDefault();
    e.stopPropagation();
    fn();
  }

  const stateClasses = blocked
    ? "cursor-not-allowed border-navy/10 opacity-60"
    : selected
      ? "cursor-pointer border-champagne shadow-soft ring-1 ring-champagne"
      : "cursor-pointer border-navy/10 hover:border-navy/30";

  return (
    <label
      id={`unit-${unit.id}`}
      className={`relative flex flex-col overflow-hidden rounded-xl border bg-white transition md:flex-row has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-champagne ${stateClasses}`}
    >
      <input
        type="radio"
        name="residence"
        value={unit.id}
        checked={selected}
        disabled={blocked}
        onChange={() => onSelect(unit.id)}
        aria-describedby={blocked ? reasonId : undefined}
        className="sr-only"
      />
      {blocked && <span id={reasonId} className="sr-only">{blockReason}</span>}

      {/* Photo area */}
      <div className="relative h-56 shrink-0 overflow-hidden bg-sand md:h-auto md:min-h-[240px] md:w-72">
        <Image
          src={images[index]}
          alt={`${unit.name} — photo ${index + 1} of ${images.length}`}
          fill
          sizes="(min-width: 768px) 288px, 100vw"
          className="object-cover"
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => stopAnd(e, () => setIndex((i) => (i - 1 + images.length) % images.length))}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1.5 shadow hover:bg-white"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => stopAnd(e, () => setIndex((i) => (i + 1) % images.length))}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1.5 shadow hover:bg-white"
            >
              <ChevronRight size={16} />
            </button>
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5" aria-hidden="true">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}

        {blocked && (
          <span className="absolute left-3 top-3 rounded-full bg-navy/85 px-3 py-1 text-xs text-ivory">
            {blockReason}
          </span>
        )}
        {selected && (
          <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-champagne text-navy">
            <Check size={16} />
          </span>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-xl">{unit.name}</h3>
        <p className="mt-1 text-sm text-navy/60">{unit.short_description ?? unit.description}</p>
        <p className="mt-3 text-sm text-navy/70">{stats.join(" · ")}</p>

        {expanded && unit.description && unit.description !== unit.short_description && (
          <p className="mt-3 text-sm text-navy/70">{unit.description}</p>
        )}

        {amenities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {visibleAmenities.map((a) => (
              <span key={a} className="rounded-full border border-navy/10 px-3 py-1 text-xs text-navy/70">
                {a}
              </span>
            ))}
            {!expanded && amenities.length > 4 && (
              <span className="px-1 py-1 text-xs text-navy/50">+{amenities.length - 4} more</span>
            )}
          </div>
        )}

        {hasMoreDetail && (
          <button
            type="button"
            onClick={(e) => stopAnd(e, () => setExpanded((v) => !v))}
            className="mt-3 self-start text-xs text-champagne-dark underline underline-offset-2"
          >
            {expanded ? "Show less" : "Full details"}
          </button>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 border-t border-navy/10 pt-4">
          <p className="text-sm text-navy/60">
            <span className="text-lg text-navy">{formatMoney(unit.base_price_per_night, currency)}</span> / night
          </p>
          {nights > 0 && (
            <p className="text-sm text-navy/70">
              {nights} night{nights === 1 ? "" : "s"} ·{" "}
              <span className="text-navy">{formatMoney(nights * unit.base_price_per_night, currency)}</span>
            </p>
          )}
        </div>
      </div>
    </label>
  );
}
