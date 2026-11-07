// Rules for staff confirming or changing the room a booking is pencilled into.
// Pure, safe in client code.

const CLOSED = new Set(["cancelled", "no_show", "checked_out"]);

// Why a booking's room can't be confirmed or changed right now, or null when it can.
export function roomAssignmentError(booking: { status: string; payment_status: string }): string | null {
  if (CLOSED.has(booking.status)) return "This booking is closed, so its room can't change.";
  if (booking.status === "pending" && booking.payment_status === "unpaid") return "This booking is still waiting for payment.";
  return null;
}

export function roomLabel(number: number | null | undefined): string {
  return typeof number === "number" ? `Room ${number}` : "No room";
}
