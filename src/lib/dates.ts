// "YYYY-MM-DD" arithmetic done in UTC so it never shifts by a day with the visitor's time zone.
export function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
