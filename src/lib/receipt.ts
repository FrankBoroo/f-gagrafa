import type { ReceiptBooking, ReceiptPayment } from "@/components/admin/Receipt";
import { roomLabel } from "@/lib/booking/room-assignment";

// The select both receipt pages use.
export const RECEIPT_SELECT =
  "id, booking_code, guest_name, check_in, check_out, status, total_amount, currency, room_confirmed, units(name), rooms(number), payments(id, amount, status, method, paid_at, created_at)";

// Maps a bookings row (with units, rooms and payments joined) to the plain props of <Receipt>.
// The room shows only once staff have confirmed it; payments are oldest first.
export function receiptFromRow(row: any): { booking: ReceiptBooking; payments: ReceiptPayment[] } {
  const payments: ReceiptPayment[] = (row.payments ?? [])
    .map((p: any) => ({
      id: p.id,
      date: p.paid_at ?? p.created_at ?? null,
      method: p.method,
      amount: Number(p.amount),
      status: p.status,
    }))
    .sort((x: ReceiptPayment, y: ReceiptPayment) => (x.date ?? "").localeCompare(y.date ?? ""));

  return {
    booking: {
      booking_code: row.booking_code,
      guest_name: row.guest_name,
      unit_name: row.units?.name ?? "Apartment",
      room: row.room_confirmed && typeof row.rooms?.number === "number" ? roomLabel(row.rooms.number) : null,
      check_in: row.check_in,
      check_out: row.check_out,
      total_amount: Number(row.total_amount),
      currency: row.currency ?? "GHS",
      status: row.status,
    },
    payments,
  };
}
