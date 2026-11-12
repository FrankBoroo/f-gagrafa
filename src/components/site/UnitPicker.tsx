"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { priceParts, unitFacts } from "@/lib/apartment-facts";
import type { PriceCurrency } from "@/lib/booking/pricing";
import { unitStayPrice } from "@/lib/booking/special-prices";
import { APARTMENT_FALLBACK_IMAGE } from "@/lib/property";
import type { Unit } from "@/lib/types";
import { EmptyState } from "@/components/ui/EmptyState";

// Why an apartment can't be chosen right now, or null if it can. Shared with
// BookingFlow so it can also drop a selection that stops being valid (e.g. the
// guest raises the guest count, or changes dates to ones that are taken).
export function getUnitBlockReason(
  unit: Unit,
  guests: number,
  availability: Record<string, boolean> | null,
  minNights: Record<string, number | null> | null = null
): string | null {
  const needed = minNights?.[unit.id];
  if (needed) return `Minimum stay of ${needed} nights for these dates`;
  if (availability && availability[unit.id] === false) return "Unavailable for these dates";
  if (guests > unit.max_guests) return `Sleeps ${unit.max_guests} max`;
  return null;
}

export function UnitPicker({
  units, selectedId, onSelect, guests, nights, checkIn, checkOut, availability, minNights = null, currency = "GHS",
}: {
  units: Unit[];
  currency?: PriceCurrency;
  selectedId: string;
  onSelect: (id: string) => void;
  guests: number;
  nights: number;
  checkIn: string;
  checkOut: string;
  availability: Record<string, boolean> | null;
  minNights?: Record<string, number | null> | null;
}) {
  if (!units.length) {
    return (
      <EmptyState
        compact
        title="No apartments are open for booking right now"
        description="Get in touch and we'll help you find dates."
        action={{ href: "/contact", label: "Contact us" }}
      />
    );
  }

  return (
    // Native radio inputs inside: arrow keys, focus, and screen readers work for free.
    <fieldset className="space-y-4">
      <legend className="sr-only">Choose your apartment</legend>
      {units.map((unit) => (
        <UnitOption
          key={unit.id}
          unit={unit}
          selected={unit.id === selectedId}
          onSelect={onSelect}
          blockReason={getUnitBlockReason(unit, guests, availability, minNights)}
          nights={nights}
          stayTotal={nights > 0 ? unitStayPrice(unit, checkIn, checkOut) : 0}
          currency={currency}
        />
      ))}
    </fieldset>
  );
}

function UnitOption({
  unit, selected, onSelect, blockReason, nights, stayTotal, currency,
}: {
  unit: Unit;
  currency: PriceCurrency;
  selected: boolean;
  onSelect: (id: string) => void;
  blockReason: string | null;
  nights: number;
  stayTotal: number;
}) {
  const images = unit.images?.length ? unit.images : [APARTMENT_FALLBACK_IMAGE];
  const [index, setIndex] = useState(0);

  const blocked = blockReason !== null;
  const reasonId = `unit-reason-${unit.id}`;

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
      className={`relative flex flex-col overflow-hidden border bg-white transition md:flex-row has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-champagne ${stateClasses}`}
    >
      <input
        type="radio"
        name="apartment"
        value={unit.id}
        checked={selected}
        disabled={blocked}
        onChange={() => onSelect(unit.id)}
        aria-describedby={blocked ? reasonId : undefined}
        className="sr-only"
      />
      {blocked && <span id={reasonId} className="sr-only">{blockReason}</span>}

      {/* Photo area */}
      <div className="relative h-56 shrink-0 overflow-hidden bg-sand md:h-auto md:min-h-[200px] md:w-72">
        <Image
          src={images[index]}
          alt={`${unit.name}, photo ${index + 1} of ${images.length}`}
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
          <span className="absolute left-3 top-3 bg-navy/85 px-3 py-1 text-xs text-ivory">
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
        <h3 className="text-xl font-normal">{unit.name}</h3>
        <p className="mt-2 text-sm text-navy/70">{unitFacts(unit).join(" · ")}</p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 border-t border-sand pt-4">
          <p className="text-sm text-navy">{priceParts(unit, currency).join(" · ")}</p>
          {nights > 0 && (
            <p className="text-sm text-navy/70">
              {nights} night{nights === 1 ? "" : "s"} ·{" "}
              <span className="text-navy">{formatMoney(stayTotal, currency)}</span>
            </p>
          )}
        </div>
      </div>
    </label>
  );
}
