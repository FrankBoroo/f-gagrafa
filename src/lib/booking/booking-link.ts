// The link from an apartment page to checkout. It lands in guests' address bars, so reading it
// back trusts nothing: anything unusable falls back to a safe value and the first checkout step.
import { toISODate } from "@/lib/booking/dates";
import type { PaymentOption } from "@/lib/booking/payment-summary";
import { isRealDate, stayDatesError } from "@/lib/booking/stay-limits";
import type { Unit } from "@/lib/types";

const DEFAULT_GUESTS = 2;

export function bookingHref({
  slug, checkIn, checkOut, guests, pay,
}: {
  slug?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  pay: PaymentOption;
}): string {
  const params = new URLSearchParams({
    ...(slug ? { unit: slug } : {}),
    checkIn,
    checkOut,
    guests: String(guests),
    pay,
  });
  return `/booking?${params.toString()}`;
}

function parseGuests(raw: string | null, maxGuests: number): number {
  const n = Number(raw);
  const guests = Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_GUESTS;
  return Math.min(guests, maxGuests);
}

export function parseBookingParams(
  params: { get(key: string): string | null },
  units: Pick<Unit, "id" | "slug" | "max_guests">[]
): { unitId: string; checkIn: string; checkOut: string; guests: number; pay: PaymentOption; startStep: 1 | 2 } {
  const unit = units.find((u) => u.slug === params.get("unit"));
  const rawIn = params.get("checkIn") ?? "";
  const rawOut = params.get("checkOut") ?? "";
  const datesUsable = isRealDate(rawIn) && isRealDate(rawOut) && rawIn >= toISODate(new Date());
  const checkIn = datesUsable ? rawIn : "";
  const checkOut = datesUsable ? rawOut : "";

  return {
    unitId: unit?.id ?? "",
    checkIn,
    checkOut,
    guests: parseGuests(params.get("guests"), unit?.max_guests ?? Math.max(DEFAULT_GUESTS, ...units.map((u) => u.max_guests))),
    pay: params.get("pay") === "full" ? "full" : "deposit",
    startStep: unit && datesUsable && stayDatesError(checkIn, checkOut) === null ? 2 : 1,
  };
}

// Whether checkout's first step can move on. Same date rules as the server, so a guest is never
// sent through the form only to be refused at Pay.
export function canContinueToDetails({
  apartmentChosen, checkIn, checkOut, guests, checking, blocked,
}: {
  apartmentChosen: boolean;
  checkIn: string;
  checkOut: string;
  guests: number;
  checking: boolean;
  blocked: boolean;
}): boolean {
  return apartmentChosen && stayDatesError(checkIn, checkOut) === null && guests >= 1 && !checking && !blocked;
}

export function withApartmentTaken(availability: Record<string, boolean> | null, unitId: string): Record<string, boolean> {
  return { ...availability, [unitId]: false };
}
