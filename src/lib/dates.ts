// "YYYY-MM-DD" arithmetic done in UTC so it never shifts by a day with the visitor's time zone.
export function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Check-out to use after the guest picks a check-in: keep a later check-out they already
// chose, otherwise default to the next day (one night).
export function defaultCheckOut(checkIn: string, currentCheckOut: string): string {
  if (!checkIn) return currentCheckOut;
  return currentCheckOut && currentCheckOut > checkIn ? currentCheckOut : addDays(checkIn, 1);
}
