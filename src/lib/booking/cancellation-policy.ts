// The cancellation rule promised on the FAQ and Terms pages, in one place so the
// guest portal estimate and the admin refund dialog can never disagree with it.
// Pure functions only (no server-only imports): used from server and client code.

export const FREE_CANCELLATION_HOURS = 72;
export const CHECK_IN_HOUR_UTC = 14; // 2 PM in Ghana, which is UTC+0

export const CANCELLATION_POLICY: string[] = [
  "Cancel more than 72 hours before check-in (2 PM on your arrival day) for a full refund of what you've paid.",
  "Cancel within 72 hours of check-in, or don't arrive, and one night is charged; the rest of what you've paid is refunded.",
];

const roundToPesewa = (amount: number) => Math.round(amount * 100) / 100;

// Whole days from today until check-in (UTC dates; Ghana is UTC+0). Negative once it has started.
export function daysUntilCheckIn(checkIn: string, now: Date = new Date()): number {
  const [y, m, d] = checkIn.split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((start - today) / 86_400_000);
}

export function isFreeCancellation(checkIn: string, now: Date = new Date()): boolean {
  const [y, m, d] = checkIn.split("-").map(Number);
  const deadline = Date.UTC(y, m - 1, d, CHECK_IN_HOUR_UTC) - FREE_CANCELLATION_HOURS * 3_600_000;
  return now.getTime() < deadline;
}

export function oneNightCharge(booking: { total_amount: number; nights: number }): number {
  return roundToPesewa(Number(booking.total_amount) / booking.nights);
}

export function suggestedRefund(
  amountPaid: number,
  booking: { check_in: string; total_amount: number; nights: number },
  now: Date = new Date()
): number {
  if (isFreeCancellation(booking.check_in, now)) return amountPaid;
  return roundToPesewa(Math.max(amountPaid - oneNightCharge(booking), 0));
}
