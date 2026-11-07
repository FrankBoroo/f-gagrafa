// Everything the admin Today page shows, worked out from plain rows. Pure, so it can
// be tested without a database. Dates are "YYYY-MM-DD" in Ghana time (UTC+0).

import { formatDate } from "@/lib/format";

export const CANCELLATION_REQUEST_PREFIX = "CANCELLATION REQUEST";

export interface TodayBooking {
  id: string;
  booking_code: string;
  guest_name: string;
  unit_name: string;
  room_id: string | null;
  room_number: number | null;
  room_confirmed: boolean;
  check_in: string;
  check_out: string;
  status: string;
  payment_status: string;
  total_amount: number;
  net_paid: number;
  currency: string;
  admin_notes: string | null;
  attention_cleared_at: string | null;
}

export interface TodayRoom {
  id: string;
  number: number;
  unit_name: string;
  last_cleaned_at: string | null;
}

export type RoomStatus = "occupied" | "needs_cleaning" | "ready" | "free";

export type AttentionKind =
  | "room_to_confirm"
  | "payment_mismatch"
  | "paid_after_cancellation"
  | "payment_review"
  | "cancellation_request";

export interface AttentionItem {
  kind: AttentionKind;
  bookingId: string;
  bookingCode: string;
  title: string;
  detail: string;
}

export interface TodayView {
  arriving: TodayBooking[];
  leaving: TodayBooking[];
  occupiedTonight: number;
  roomCount: number;
  balancesOwed: number;
  attention: AttentionItem[];
  rooms: { room: TodayRoom; status: RoomStatus }[];
}

// The exact prefixes src/lib/payments/booking-payment.ts writes into admin_notes.
export const ATTENTION_MARKERS: { marker: string; kind: AttentionKind }[] = [
  { marker: "PAYMENT MISMATCH", kind: "payment_mismatch" },
  { marker: "PAID AFTER CANCELLATION", kind: "paid_after_cancellation" },
  { marker: "PAID AFTER HOLD EXPIRED", kind: "payment_review" },
  { marker: "PAID BUT NOT CONFIRMED", kind: "payment_review" },
];

const ATTENTION_TITLES: Record<AttentionKind, string> = {
  room_to_confirm: "Room to confirm",
  payment_mismatch: "Payment mismatch",
  paid_after_cancellation: "Paid after cancellation",
  payment_review: "Payment needs review",
  cancellation_request: "Cancellation request",
};

const STAY_STATUSES = new Set(["confirmed", "checked_in", "checked_out"]);
const CHECK_OUT_TIME = "T11:00:00Z"; // 11 AM in Ghana

// A real stay: confirmed or later, or a checkout that has taken money (paid but not yet
// confirmed). Unpaid holds and cancelled bookings are not stays.
export function countsAsStay(b: Pick<TodayBooking, "status" | "payment_status">): boolean {
  return STAY_STATUSES.has(b.status) || (b.status === "pending" && b.payment_status !== "unpaid");
}

export function balanceOwed(b: Pick<TodayBooking, "total_amount" | "net_paid">): number {
  return Math.max(Math.round((Number(b.total_amount) - Number(b.net_paid)) * 100) / 100, 0);
}

// One room's state today. First match wins: a guest staying on is "occupied"; a room
// nobody cleaned since its last guest left (11 AM) "needs cleaning"; a clean room with
// an arrival today is "ready"; anything else is "free".
export function roomStatus(room: TodayRoom, stays: TodayBooking[], today: string): RoomStatus {
  const staying = stays.some(
    (s) => (s.check_in < today && today < s.check_out) || (s.status === "checked_in" && s.check_out > today)
  );
  if (staying) return "occupied";

  const lastCheckOut = stays
    .map((s) => s.check_out)
    .filter((d) => d <= today)
    .sort()
    .pop();
  if (lastCheckOut) {
    const cleaned = room.last_cleaned_at ? Date.parse(room.last_cleaned_at) : null;
    if (cleaned === null || cleaned < Date.parse(`${lastCheckOut}${CHECK_OUT_TIME}`)) return "needs_cleaning";
  }

  if (stays.some((s) => s.check_in === today)) return "ready";
  return "free";
}

function attentionFor(b: TodayBooking): AttentionItem | null {
  if (b.attention_cleared_at || !b.admin_notes) return null;
  const hit = ATTENTION_MARKERS.find((m) => b.admin_notes!.includes(m.marker));
  if (!hit) return null;
  return {
    kind: hit.kind,
    bookingId: b.id,
    bookingCode: b.booking_code,
    title: ATTENTION_TITLES[hit.kind],
    detail: `${b.booking_code} · ${b.guest_name}`,
  };
}

export function buildToday(input: {
  today: string;
  bookings: TodayBooking[];
  rooms: TodayRoom[];
  cancellationRequests: { bookingId: string; bookingCode: string; createdAt: string }[];
}): TodayView {
  const { today } = input;
  const stays = input.bookings.filter(countsAsStay);

  const arriving = stays.filter((b) => b.check_in === today);
  const leaving = stays.filter((b) => b.check_out === today);

  const occupiedRooms = new Set(
    stays.filter((b) => b.room_id && b.check_in <= today && today < b.check_out).map((b) => b.room_id as string)
  );

  const balancesOwed =
    Math.round(
      stays
        .filter((b) => b.check_out >= today && b.status !== "checked_out")
        .reduce((sum: number, b: TodayBooking) => sum + balanceOwed(b), 0) * 100
    ) / 100;

  const roomsToConfirm: AttentionItem[] = stays
    .filter((b) => !b.room_confirmed && b.check_out >= today)
    .map((b) => ({
      kind: "room_to_confirm" as const,
      bookingId: b.id,
      bookingCode: b.booking_code,
      title: ATTENTION_TITLES.room_to_confirm,
      detail: `${b.guest_name}, ${b.unit_name}, ${formatDate(b.check_in)} → ${formatDate(b.check_out)}`,
    }));

  const payments = input.bookings.map(attentionFor).filter((i): i is AttentionItem => i !== null);

  const requests: AttentionItem[] = input.cancellationRequests.map((r) => ({
    kind: "cancellation_request" as const,
    bookingId: r.bookingId,
    bookingCode: r.bookingCode,
    title: ATTENTION_TITLES.cancellation_request,
    detail: r.bookingCode,
  }));

  const rooms = [...input.rooms]
    .sort((a, b) => a.number - b.number)
    .map((room) => ({ room, status: roomStatus(room, stays.filter((s) => s.room_id === room.id), today) }));

  return {
    arriving,
    leaving,
    occupiedTonight: occupiedRooms.size,
    roomCount: input.rooms.length,
    balancesOwed,
    attention: [...roomsToConfirm, ...payments, ...requests],
    rooms,
  };
}
