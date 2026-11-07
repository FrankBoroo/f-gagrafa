// The admin calendar: one row per room, with the stays, unpaid holds and blocked dates
// that fall in one month. Pure, so it can be tested without a database.
import { roomLabel } from "@/lib/booking/room-assignment";
import { addDays } from "@/lib/booking/dates";

export interface CalendarSegment {
  kind: "booking" | "hold" | "block";
  id: string;
  label: string;
  startDay: number; // 1-based day of the month
  endDay: number; // last night shown, inclusive
  confirmed: boolean;
  href: string | null;
}

export interface RoomRow {
  roomId: string;
  label: string;
  unitName: string;
  segments: CalendarSegment[];
}

interface CalendarInput {
  year: number;
  month: number; // 1-12
  rooms: { id: string; number: number; unit_id: string; unit_name: string }[];
  bookings: {
    id: string;
    booking_code: string;
    guest_name: string;
    room_id: string | null;
    room_confirmed: boolean;
    check_in: string;
    check_out: string;
    status: string;
    payment_status: string;
  }[];
  blocks: { id: string; unit_id: string; room_id: string | null; start_date: string; end_date: string; reason: string | null }[];
}

const pad = (n: number) => String(n).padStart(2, "0");

// The days of the month covered by nights from `start` up to (not including) `end`, or null.
function clip(start: string, end: string, monthStart: string, monthEnd: string): { startDay: number; endDay: number } | null {
  const lastNight = addDays(end, -1);
  const from = start > monthStart ? start : monthStart;
  const to = lastNight < monthEnd ? lastNight : monthEnd;
  if (from > to) return null;
  return { startDay: Number(from.slice(8, 10)), endDay: Number(to.slice(8, 10)) };
}

export function roomCalendarRows(input: CalendarInput): RoomRow[] {
  const daysInMonth = new Date(Date.UTC(input.year, input.month, 0)).getUTCDate();
  const monthStart = `${input.year}-${pad(input.month)}-01`;
  const monthEnd = `${input.year}-${pad(input.month)}-${pad(daysInMonth)}`;

  return [...input.rooms]
    .sort((a, b) => a.number - b.number)
    .map((room) => {
      const segments: CalendarSegment[] = [];

      for (const b of input.bookings) {
        if (b.room_id !== room.id) continue;
        const days = clip(b.check_in, b.check_out, monthStart, monthEnd);
        if (!days) continue;
        const hold = b.status === "pending" && b.payment_status === "unpaid";
        segments.push({
          kind: hold ? "hold" : "booking",
          id: b.id,
          label: b.guest_name,
          ...days,
          confirmed: b.room_confirmed,
          href: `/admin/bookings?q=${encodeURIComponent(b.booking_code)}`,
        });
      }

      for (const k of input.blocks) {
        const applies = k.room_id === room.id || (k.room_id === null && k.unit_id === room.unit_id);
        if (!applies) continue;
        const days = clip(k.start_date, k.end_date, monthStart, monthEnd);
        if (!days) continue;
        segments.push({ kind: "block", id: k.id, label: k.reason?.trim() || "Blocked", ...days, confirmed: true, href: null });
      }

      segments.sort((a, b) => a.startDay - b.startDay);
      return { roomId: room.id, label: roomLabel(room.number), unitName: room.unit_name, segments };
    });
}
