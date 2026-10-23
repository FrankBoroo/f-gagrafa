"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { calculateNights } from "@/lib/types";
import { addDays, defaultCheckOut } from "@/lib/dates";
import type { Unit } from "@/lib/types";

export function BookingWidget({ unit }: { unit: Unit }) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);
  const [today, setToday] = useState("");

  // `min` for the date inputs. Set after mount so server and client markup match.
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  function handleCheckInChange(value: string) {
    setCheckIn(value);
    setCheckOut((current: string) => defaultCheckOut(value, current));
  }

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const n = calculateNights(checkIn, checkOut);
    return n > 0 ? n : 0;
  }, [checkIn, checkOut]);

  const total = nights * unit.base_price_per_night;

  function goToBooking() {
    const params = new URLSearchParams({
      unit: unit.slug,
      checkIn,
      checkOut,
      guests: String(guests),
    });
    router.push(`/booking?${params.toString()}`);
  }

  return (
    <div className="card sticky top-28 p-6">
      <p className="text-2xl">
        {formatCurrency(unit.base_price_per_night)}
        <span className="text-sm text-navy/50"> / night</span>
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <label className="col-span-1 flex flex-col text-xs text-navy/60">
          Check-in
          <input
            type="date"
            value={checkIn}
            min={today || undefined}
            onChange={(e) => handleCheckInChange(e.target.value)}
            className="mt-1 rounded-lg border border-navy/15 px-3 py-2 text-sm text-navy"
          />
        </label>
        <label className="col-span-1 flex flex-col text-xs text-navy/60">
          Check-out
          <input
            type="date"
            value={checkOut}
            min={checkIn ? addDays(checkIn, 1) : today || undefined}
            onChange={(e) => setCheckOut(e.target.value)}
            className="mt-1 rounded-lg border border-navy/15 px-3 py-2 text-sm text-navy"
          />
        </label>
        <label className="col-span-2 flex flex-col text-xs text-navy/60">
          Guests
          <input
            type="number"
            min={1}
            max={unit.max_guests}
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="mt-1 rounded-lg border border-navy/15 px-3 py-2 text-sm text-navy"
          />
        </label>
      </div>

      {nights > 0 && (
        <div className="mt-5 space-y-2 border-t border-navy/10 pt-5 text-sm text-navy/70">
          <div className="flex justify-between">
            <span>{formatCurrency(unit.base_price_per_night)} × {nights} nights</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between text-base text-navy">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      )}

      <button
        className="btn-primary mt-6 w-full disabled:cursor-not-allowed"
        disabled={!checkIn || !checkOut || nights <= 0}
        onClick={goToBooking}
      >
        Book Now
      </button>
      <p className="mt-3 text-center text-xs text-navy/40">Availability confirmed at checkout</p>
    </div>
  );
}
