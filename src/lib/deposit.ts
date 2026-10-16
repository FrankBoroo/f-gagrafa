import { daysUntilCheckIn } from "@/lib/cancellation-policy";

// Deposit rules in one place, used by the booking page (to show the option) and by the
// server action (to enforce it). Pure functions, safe to import from client code.

// A deposit is only offered when check-in is at least this many days away; closer than that,
// the guest pays in full.
export const DEPOSIT_MIN_DAYS_BEFORE_CHECKIN = 7;

// The deposit for a total, rounded to the pesewa. `percent` is a whole number like 50.
export function depositAmount(total: number, percent: number): number {
  return Math.round(total * percent) / 100;
}

export function canOfferDeposit(checkIn: string, percent: number, now: Date = new Date()): boolean {
  if (!(percent > 0 && percent <= 90)) return false;
  return daysUntilCheckIn(checkIn, now) >= DEPOSIT_MIN_DAYS_BEFORE_CHECKIN;
}
