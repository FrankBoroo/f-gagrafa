// What the public pages say about an apartment type, built only from values held on the type.
import { formatMoney } from "@/lib/format";
import { APARTMENT_FALLBACK_IMAGE } from "@/lib/property";
import type { Unit } from "@/lib/types";

export function coverImage(unit: Pick<Unit, "images">): string {
  return unit.images?.[0] ?? APARTMENT_FALLBACK_IMAGE;
}

export function unitFacts(unit: Pick<Unit, "max_guests" | "monthly_price" | "size_sqm">): string[] {
  return [
    unit.max_guests === 1 ? "1 adult" : `Up to ${unit.max_guests} adults`,
    unit.monthly_price ? "A night or a month" : "By the night",
    ...(unit.size_sqm ? [`${unit.size_sqm} m²`] : []),
  ];
}

export function priceParts(unit: Pick<Unit, "base_price_per_night" | "monthly_price">, currency: string): string[] {
  return [
    `${formatMoney(unit.base_price_per_night, currency)} a night`,
    ...(unit.monthly_price ? [`${formatMoney(unit.monthly_price, currency)} a month`] : []),
  ];
}
