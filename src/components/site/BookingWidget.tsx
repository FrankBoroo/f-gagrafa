"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkUnitsAvailability } from "@/app/booking/actions";
import { PaymentChoice } from "@/components/site/PaymentChoice";
import { bookingHref } from "@/lib/booking/booking-link";
import { addDays, calculateNights, defaultCheckOut } from "@/lib/booking/dates";
import { paymentSummary, type PaymentOption } from "@/lib/booking/payment-summary";
import type { Pricing } from "@/lib/booking/pricing";
import { MIN_NIGHTS, stayDatesError } from "@/lib/booking/stay-limits";
import { stayPrice, unitRates, usesMonthlyRate } from "@/lib/booking/stay-price";
import { formatMoney } from "@/lib/format";
import type { Unit } from "@/lib/types";

type Availability = "unknown" | "checking" | "free" | "taken" | "failed";

const INPUT = "mt-1 w-full border border-sand bg-white px-3 py-2 text-sm text-navy";

// The booking panel on an apartment page. It shows the real price and whether the dates are free;
// the guest's details and the payment itself happen at /booking, where the server decides.
export function BookingWidget({
  unit, depositPercent, pricing,
}: {
  unit: Unit;
  depositPercent: number;
  pricing: Pricing;
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(Math.min(2, unit.max_guests));
  const [today, setToday] = useState("");
  const [option, setOption] = useState<PaymentOption>("deposit");
  const [availability, setAvailability] = useState<Availability>("unknown");

  // `min` for the date inputs. Set after mount so server and client markup match.
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const money = (amount: number) => formatMoney(amount, pricing.currency);
  const datesChosen = Boolean(checkIn && checkOut);
  const datesError = datesChosen ? stayDatesError(checkIn, checkOut) : null;
  const datesOk = datesChosen && datesError === null;
  const nights = datesOk ? calculateNights(checkIn, checkOut) : 0;
  const total = stayPrice(nights, unitRates(unit));
  const summary = paymentSummary({ total, depositPercent, pricing, option });

  useEffect(() => {
    if (!datesOk) {
      setAvailability("unknown");
      return;
    }
    let cancelled = false; // ignore answers that arrive after the dates changed again
    setAvailability("checking");
    checkUnitsAvailability(checkIn, checkOut)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) setAvailability("failed");
        else setAvailability(res.availability[unit.id] === false ? "taken" : "free");
      })
      .catch(() => {
        if (!cancelled) setAvailability("failed"); // don't block the guest: payment re-checks anyway
      });
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, datesOk, unit.id]);

  function handleCheckInChange(value: string) {
    setCheckIn(value);
    setCheckOut((current: string) => defaultCheckOut(value, current, MIN_NIGHTS));
  }

  const paused = nights > 0 && summary.chargeDueNow === null;
  const canContinue = datesOk && !paused && (availability === "free" || availability === "failed");

  return (
    <div data-hide-floating-book className="panel p-5 md:p-6 lg:sticky lg:top-28">
      <h2 className="text-2xl font-normal">Reserve the {unit.name}</h2>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="text-xs text-navy/70">
          Check-in
          <input
            type="date"
            value={checkIn}
            min={today || undefined}
            onChange={(e) => handleCheckInChange(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="text-xs text-navy/70">
          Check-out
          <input
            type="date"
            value={checkOut}
            min={checkIn ? addDays(checkIn, MIN_NIGHTS) : today || undefined}
            onChange={(e) => setCheckOut(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="col-span-2 text-xs text-navy/70">
          Guests
          <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className={INPUT}>
            {Array.from({ length: unit.max_guests }, (_, i: number) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} {i === 0 ? "adult" : "adults"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {datesError && <p className="mt-4 text-sm text-red-700">{datesError}</p>}

      {nights > 0 && (
        <div className="mt-5">
          <div className="flex justify-between text-sm">
            <span className="text-navy/70">
              {usesMonthlyRate(nights, unit.monthly_price)
                ? `Monthly rate, ${nights} nights`
                : `${money(unit.base_price_per_night)} × ${nights} nights`}
            </span>
            <span>{money(total)}</span>
          </div>

          {summary.depositOffered && (
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">How would you like to pay?</legend>
              <PaymentChoice
                checked={summary.payingDeposit}
                onSelect={() => setOption("deposit")}
                title="Down payment"
                amount={money(summary.deposit)}
                note={`Secures your dates. The remaining ${money(total - summary.deposit)} is due by arrival.`}
              />
              <PaymentChoice
                checked={!summary.payingDeposit}
                onSelect={() => setOption("full")}
                title="Pay in full"
                amount={money(total)}
              />
            </fieldset>
          )}
        </div>
      )}

      <div aria-live="polite" className="mt-4 text-sm">
        {availability === "checking" && <p className="text-navy/70">Checking these dates…</p>}
        {availability === "failed" && <p className="text-navy/70">We&rsquo;ll confirm availability at payment.</p>}
        {availability === "taken" && (
          <p className="text-red-700">
            Not available for these dates.{" "}
            <Link
              href={bookingHref({ checkIn, checkOut, guests, pay: option })}
              className="text-navy underline underline-offset-2"
            >
              See other apartments
            </Link>
          </p>
        )}
        {paused && <p className="text-red-700">Online booking is paused while we update our rates. Please contact us to book.</p>}
      </div>

      <button
        type="button"
        className="btn-gold mt-2 w-full disabled:cursor-not-allowed"
        disabled={!canContinue}
        onClick={() => router.push(bookingHref({ slug: unit.slug, checkIn, checkOut, guests, pay: option }))}
      >
        Continue to payment
      </button>
      <p className="mt-3 text-center text-xs text-navy/70">
        Card or Mobile Money via Paystack{pricing.currency === "USD" ? " · charged in cedis" : ""}
      </p>
    </div>
  );
}
