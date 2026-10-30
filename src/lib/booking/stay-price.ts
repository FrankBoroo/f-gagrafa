// What a stay costs in the Settings price currency. Pure, so the browser's estimate and the
// server's charge use the same rule; the server is the one that decides.

export const MONTHLY_MIN_NIGHTS = 30;

interface Rates {
  nightly: number;
  monthly: number | null;
}

export function usesMonthlyRate(nights: number, monthly: number | null): boolean {
  return nights >= MONTHLY_MIN_NIGHTS && Boolean(monthly);
}

// From 30 nights the monthly rate applies, pro rata for the extra nights.
export function stayPrice(nights: number, rates: Rates): number {
  const price = usesMonthlyRate(nights, rates.monthly)
    ? (Number(rates.monthly) * nights) / MONTHLY_MIN_NIGHTS
    : rates.nightly * nights;
  return Math.round(price * 100) / 100;
}

export function unitRates(unit: { base_price_per_night: number; monthly_price: number | null }): Rates {
  return {
    nightly: Number(unit.base_price_per_night),
    monthly: unit.monthly_price === null ? null : Number(unit.monthly_price),
  };
}
