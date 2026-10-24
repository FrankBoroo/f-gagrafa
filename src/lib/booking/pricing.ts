import { formatMoney } from "@/lib/format";

// Price currency rules in one place. Unit prices and fixed promo amounts are in the
// currency picked in Settings; Paystack always charges cedis, so a USD total is converted
// at the Settings rate when the booking is made. Pure functions, safe in client code.

export type PriceCurrency = "GHS" | "USD";

export interface Pricing {
  currency: PriceCurrency;
  usdToGhsRate: number | null; // cedis per dollar; null = not set
}

export const GHS_PRICING: Pricing = { currency: "GHS", usdToGhsRate: null };

// Anything missing or unusable falls back to cedis, so the site works before the migration runs.
export function pricingFromSettings(
  row: { price_currency?: unknown; usd_to_ghs_rate?: unknown } | null | undefined
): Pricing {
  if (row?.price_currency !== "USD") return GHS_PRICING;
  const rate = Number(row.usd_to_ghs_rate);
  return { currency: "USD", usdToGhsRate: Number.isFinite(rate) && rate > 0 ? rate : null };
}

// The cedi amount to charge for a price-currency amount, rounded to the pesewa.
// null means prices are in USD but no rate is set, so nothing can be charged.
export function toChargeAmount(amount: number, pricing: Pricing): number | null {
  if (pricing.currency === "GHS") return Math.round(amount * 100) / 100;
  if (!pricing.usdToGhsRate) return null;
  return Math.round(amount * pricing.usdToGhsRate * 100) / 100;
}

// " ($400)" for a booking made with USD prices, so guests see the price they booked at next
// to the cedi amount; "" for cedi bookings.
export function bookedPriceSuffix(booking: {
  display_currency?: string | null;
  display_total?: number | string | null;
}): string {
  if (!booking.display_currency || booking.display_total === null || booking.display_total === undefined) return "";
  return ` (${formatMoney(Number(booking.display_total), booking.display_currency)})`;
}
