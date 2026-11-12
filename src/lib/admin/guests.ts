// Guest records. Guests have no accounts, so a guest is everyone who booked with the
// same email (trimmed, lower-cased). Pure, so it can be tested without a database.

export interface GuestSummary {
  key: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  latestBookingId: string;
  stays: number;
  bookings: number;
  totalPaid: number;
  currency: string;
  lastStay: string;
  isReturning: boolean;
}

export interface GuestBookingRow {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  check_in: string;
  status: string;
  currency: string;
  net_paid: number;
}

const NOT_A_STAY = new Set(["cancelled", "no_show"]);

export function guestKey(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

// What a booking has actually received: successful payments plus refund rows (negative).
export function netPaid(payments: { amount: number | string; status: string }[] | null | undefined): number {
  const sum = (payments ?? [])
    .filter((p: { amount: number | string; status: string }) => p.status === "success" || p.status === "refunded")
    .reduce((total: number, p: { amount: number | string; status: string }) => total + Number(p.amount), 0);
  return Math.round(sum * 100) / 100;
}

// One row per guest, most recent check-in first. Name, phone and the booking that
// addresses the guest record come from the guest's latest check-in.
export function groupGuests(rows: GuestBookingRow[]): GuestSummary[] {
  const guests = new Map<string, GuestSummary>();

  for (const row of rows) {
    const key = guestKey(row.guest_email);
    const isStay = !NOT_A_STAY.has(row.status);
    const paid = Number(row.net_paid) || 0;
    const existing = guests.get(key);

    if (!existing) {
      guests.set(key, {
        key,
        guest_name: row.guest_name,
        guest_email: row.guest_email.trim(),
        guest_phone: row.guest_phone ?? "",
        latestBookingId: row.id,
        stays: isStay ? 1 : 0,
        bookings: 1,
        totalPaid: paid,
        currency: row.currency,
        lastStay: row.check_in,
        isReturning: false,
      });
      continue;
    }

    existing.bookings += 1;
    if (isStay) existing.stays += 1;
    existing.totalPaid = Math.round((existing.totalPaid + paid) * 100) / 100;
    if (row.check_in > existing.lastStay) {
      existing.lastStay = row.check_in;
      existing.guest_name = row.guest_name;
      existing.guest_email = row.guest_email.trim();
      existing.guest_phone = row.guest_phone ?? "";
      existing.latestBookingId = row.id;
      existing.currency = row.currency;
    }
  }

  return Array.from(guests.values())
    .map((g: GuestSummary) => ({ ...g, isReturning: g.stays >= 2 }))
    .sort((a: GuestSummary, b: GuestSummary) => (a.lastStay < b.lastStay ? 1 : a.lastStay > b.lastStay ? -1 : 0));
}
