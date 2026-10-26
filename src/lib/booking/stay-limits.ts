import { addDays, calculateNights, toISODate } from "@/lib/booking/dates";

// Longest stay and furthest check-in that can be booked online. Longer or later stays go
// through the team, so a single request can't hold a residence for years.
export const MAX_NIGHTS = 365;
export const MAX_DAYS_AHEAD = 730;

const isRealDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && toISODate(new Date(d)) === d;

// Why these dates can't be booked online, or null when they can. Checked on the server
// (the date pickers enforce none of it).
export function stayDatesError(checkIn: string, checkOut: string, today: string = toISODate(new Date())): string | null {
  if (!isRealDate(checkIn) || !isRealDate(checkOut)) return "Choose valid dates";
  if (checkOut <= checkIn) return "Check-out must be after check-in";
  if (checkIn < today) return "Check-in can't be in the past";
  if (calculateNights(checkIn, checkOut) > MAX_NIGHTS) {
    return `Online bookings are limited to ${MAX_NIGHTS} nights — contact us for longer stays`;
  }
  if (checkIn > addDays(today, MAX_DAYS_AHEAD)) {
    return "Online bookings open up to two years ahead — contact us for later dates";
  }
  return null;
}

export function guestCountError(adults: number, children: number, maxGuests: number): string | null {
  if (adults + children <= maxGuests) return null;
  return `This residence sleeps ${maxGuests} guest${maxGuests === 1 ? "" : "s"} at most`;
}
