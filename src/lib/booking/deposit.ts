// Deposit rules in one place, used by the booking page (to show the option) and by the
// server action (to enforce it). Pure functions, safe to import from client code.

// The deposit for a total, rounded to the pesewa. `percent` is a whole number like 50.
export function depositAmount(total: number, percent: number): number {
  return Math.round(total * percent) / 100;
}

export function canOfferDeposit(percent: number): boolean {
  return percent > 0 && percent <= 90;
}
