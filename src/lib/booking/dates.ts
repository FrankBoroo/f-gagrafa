// "YYYY-MM-DD" for a moment in time, in UTC (the form dates are stored and compared in).
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// "YYYY-MM-DD" arithmetic done in UTC so it never shifts by a day with the visitor's time zone.
export function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

// Check-out to use after the guest picks a check-in: keep a later check-out they already
// chose, otherwise default to the next day (one night).
export function defaultCheckOut(checkIn: string, currentCheckOut: string, minNights = 1): string {
  if (!checkIn) return currentCheckOut;
  const earliest = addDays(checkIn, minNights);
  return currentCheckOut && currentCheckOut >= earliest ? currentCheckOut : earliest;
}

// Nights between two "YYYY-MM-DD" dates (negative when check-out is before check-in).
export function calculateNights(checkIn: string, checkOut: string): number {
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  return Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));
}
