// A website booking that overlaps an imported Airbnb reservation on the same room.
// Pure, so it can be tested without a database. Dates are "YYYY-MM-DD".
import { formatDate } from "@/lib/format";
import { countsAsStay } from "@/lib/admin/today";

export interface ExternalStay {
  id: string;
  room_id: string;
  check_in: string;
  check_out: string;
  guest_name: string | null;
}

interface ClashBooking {
  id: string;
  booking_code: string;
  guest_name: string;
  room_id: string | null;
  check_in: string;
  check_out: string;
  status: string;
  payment_status: string;
}

export interface Clash {
  bookingId: string;
  bookingCode: string;
  externalId: string;
  detail: string;
}

// Live bookings (see countsAsStay) that share a room with an Airbnb stay and overlap it.
// Half-open ranges: one guest leaving the day another arrives is not a clash.
export function findClashes(external: ExternalStay[], bookings: ClashBooking[], today: string): Clash[] {
  const clashes: Clash[] = [];
  for (const b of bookings) {
    if (!b.room_id || !countsAsStay(b) || b.check_out < today) continue;
    for (const e of external) {
      if (e.room_id !== b.room_id || e.check_out < today) continue;
      if (b.check_in < e.check_out && e.check_in < b.check_out) {
        clashes.push({
          bookingId: b.id,
          bookingCode: b.booking_code,
          externalId: e.id,
          detail: `${b.guest_name}, ${formatDate(b.check_in)} → ${formatDate(b.check_out)}, overlaps ${e.guest_name ?? "an Airbnb booking"}, ${formatDate(e.check_in)} → ${formatDate(e.check_out)}`,
        });
      }
    }
  }
  return clashes;
}
