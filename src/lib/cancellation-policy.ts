// The cancellation tiers promised on the FAQ and Terms pages, in one place so the
// guest portal estimate and the admin refund dialog can never disagree with them.
// Pure functions only (no server-only imports): used from server and client code.

export interface RefundTier {
  minDaysBefore: number;
  percent: number;
  label: string;
}

export const REFUND_TIERS: RefundTier[] = [
  { minDaysBefore: 7, percent: 100, label: "7 or more days before check-in" },
  { minDaysBefore: 2, percent: 50, label: "2 to 6 days before check-in" },
  { minDaysBefore: -Infinity, percent: 0, label: "Within 48 hours of check-in, or after check-in" },
];

// Whole days from today until check-in (UTC dates; Ghana is UTC+0). Negative once it has started.
export function daysUntilCheckIn(checkIn: string, now: Date = new Date()): number {
  const [y, m, d] = checkIn.split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((start - today) / 86_400_000);
}

export function refundPercentFor(checkIn: string, now: Date = new Date()): number {
  const days = daysUntilCheckIn(checkIn, now);
  return (REFUND_TIERS.find((tier) => days >= tier.minDaysBefore) ?? REFUND_TIERS[REFUND_TIERS.length - 1]).percent;
}

export function suggestedRefund(amountPaid: number, checkIn: string, now: Date = new Date()): number {
  return Math.round(amountPaid * refundPercentFor(checkIn, now)) / 100;
}
