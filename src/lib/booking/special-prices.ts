// Special nightly prices and minimum stays for date ranges, per apartment type (set in
// Admin → Special prices). Pure, so the browser's estimate and the server's charge use the
// same rule; the server is the one that decides. A range's end_date is exclusive, like a
// booking's check-out: 24 → 27 Dec covers the nights of 24, 25 and 26.

import { addDays, calculateNights } from "@/lib/booking/dates";
import { stayPrice, unitRates, usesMonthlyRate, type Rates } from "@/lib/booking/stay-price";

export interface SpecialPrice {
  start_date: string;
  end_date: string;
  nightly_price: number | null;
  min_nights: number | null;
}

function coversNight(special: SpecialPrice, night: string): boolean {
  return special.start_date <= night && night < special.end_date;
}

// What a stay costs in the Settings price currency. A stay on the monthly rate keeps the
// monthly rate; otherwise each night costs its special price, or the type's nightly price.
export function stayPriceForDates(input: {
  checkIn: string;
  checkOut: string;
  rates: Rates;
  specials: SpecialPrice[];
}): number {
  const nights = calculateNights(input.checkIn, input.checkOut);
  if (!(nights > 0)) return 0;
  if (usesMonthlyRate(nights, input.rates.monthly)) return stayPrice(nights, input.rates);

  const priced = input.specials.filter((s: SpecialPrice) => s.nightly_price !== null);
  let cents = 0;
  for (let i = 0; i < nights; i += 1) {
    const night = addDays(input.checkIn, i);
    const special = priced.find((s: SpecialPrice) => coversNight(s, night));
    cents += Math.round(Number(special ? special.nightly_price : input.rates.nightly) * 100);
  }
  return cents / 100;
}

// The longest minimum stay among the ranges that cover any night of the stay, or null.
export function requiredMinNights(checkIn: string, checkOut: string, specials: SpecialPrice[]): number | null {
  const minimums = specials
    .filter((s: SpecialPrice) => s.min_nights !== null && s.start_date < checkOut && s.end_date > checkIn)
    .map((s: SpecialPrice) => Number(s.min_nights));
  return minimums.length ? Math.max(...minimums) : null;
}

export function minNightsError(nights: number, required: number | null): string | null {
  if (required === null || nights >= required) return null;
  return `These dates need a stay of at least ${required} nights.`;
}

// The price of a stay in one apartment type, using the special prices loaded with it.
export function unitStayPrice(
  unit: { base_price_per_night: number; monthly_price: number | null; special_prices?: SpecialPrice[] },
  checkIn: string,
  checkOut: string
): number {
  if (!checkIn || !checkOut) return 0;
  return stayPriceForDates({ checkIn, checkOut, rates: unitRates(unit), specials: unit.special_prices ?? [] });
}
