// Money: balances owed, revenue by apartment type and occupancy by room, worked out from
// plain rows. Pure, so it can be tested without a database.

import { calculateNights } from "@/lib/booking/dates";
import { roomLabel } from "@/lib/booking/room-assignment";
import { MONTHLY_MIN_NIGHTS } from "@/lib/booking/stay-price";
import { balanceOwed, countsAsStay } from "@/lib/admin/today";

export interface MoneyBooking {
  id: string;
  booking_code: string;
  guest_name: string;
  unit_id: string;
  unit_name: string;
  room_id: string | null;
  room_number: number | null;
  check_in: string;
  check_out: string;
  status: string;
  payment_status: string;
  total_amount: number;
  net_paid: number;
  currency: string;
}

export type BalanceOwed = MoneyBooking & { owed: number; overdue: boolean };

// Stays that still owe money, soonest check-in first. A balance is due by arrival, so it
// is overdue from the check-in day. Checked-out stays, cancelled bookings and unpaid
// holds are left out.
export function balancesOwed(bookings: MoneyBooking[], today: string): BalanceOwed[] {
  return bookings
    .filter((b: MoneyBooking) => countsAsStay(b) && b.status !== "checked_out")
    .map((b: MoneyBooking) => ({ ...b, owed: balanceOwed(b), overdue: b.check_in <= today }))
    .filter((b: BalanceOwed) => b.owed > 0)
    .sort((a: BalanceOwed, b: BalanceOwed) => (a.check_in < b.check_in ? -1 : a.check_in > b.check_in ? 1 : 0));
}

export function occupancyPercent(roomsOccupied: number, roomCount: number): number {
  if (!(roomCount > 0)) return 0;
  return Math.round((roomsOccupied / roomCount) * 100);
}

export interface RoomOccupancy {
  roomId: string;
  label: string;
  unitName: string;
  nightsBooked: number;
  nightsInRange: number;
  percent: number;
}

// For each room, the nights in [from, to) covered by its stays. Rooms in number order.
export function occupancyByRoom(input: {
  rooms: { id: string; number: number; unit_name: string }[];
  bookings: MoneyBooking[];
  from: string;
  to: string;
}): RoomOccupancy[] {
  const nightsInRange = Math.max(calculateNights(input.from, input.to), 0);
  const stays = input.bookings.filter((b: MoneyBooking) => countsAsStay(b));

  return [...input.rooms]
    .sort((a: { number: number }, b: { number: number }) => a.number - b.number)
    .map((room: { id: string; number: number; unit_name: string }) => {
      const booked = stays
        .filter((b: MoneyBooking) => b.room_id === room.id)
        .reduce((sum: number, b: MoneyBooking) => {
          const start = b.check_in > input.from ? b.check_in : input.from;
          const end = b.check_out < input.to ? b.check_out : input.to;
          return sum + Math.max(calculateNights(start, end), 0);
        }, 0);
      const nightsBooked = Math.min(booked, nightsInRange);
      return {
        roomId: room.id,
        label: roomLabel(room.number),
        unitName: room.unit_name,
        nightsBooked,
        nightsInRange,
        percent: occupancyPercent(nightsBooked, nightsInRange),
      };
    });
}

export interface TypeRevenue {
  unitId: string;
  unitName: string;
  nightly: number;
  monthly: number;
  total: number;
}

// What stays have paid (net of refunds), per apartment type, split into nightly stays and
// monthly stays (30 nights or more). Biggest total first.
export function revenueByType(bookings: MoneyBooking[]): TypeRevenue[] {
  const cents = new Map<string, { unitName: string; nightly: number; monthly: number }>();
  for (const b of bookings) {
    if (!countsAsStay(b)) continue;
    const row = cents.get(b.unit_id) ?? { unitName: b.unit_name, nightly: 0, monthly: 0 };
    const paid = Math.round(Number(b.net_paid) * 100);
    if (calculateNights(b.check_in, b.check_out) >= MONTHLY_MIN_NIGHTS) row.monthly += paid;
    else row.nightly += paid;
    cents.set(b.unit_id, row);
  }
  return Array.from(cents.entries())
    .map(([unitId, row]: [string, { unitName: string; nightly: number; monthly: number }]) => ({
      unitId,
      unitName: row.unitName,
      nightly: row.nightly / 100,
      monthly: row.monthly / 100,
      total: (row.nightly + row.monthly) / 100,
    }))
    .sort((a: TypeRevenue, b: TypeRevenue) => b.total - a.total);
}

export interface MonthRange {
  year: number;
  month: number; // 1-12
  key: string; // "YYYY-MM"
  from: string; // first day
  to: string; // first day of the next month (exclusive)
  previous: string;
  next: string;
}

const monthKey = (year: number, month: number): string => `${year}-${String(month).padStart(2, "0")}`;

// The month named in the address ("2026-12"), or the current month for anything else.
export function monthRange(param: string | undefined, today: string): MonthRange {
  const match = /^(20\d{2})-(0[1-9]|1[0-2])$/.exec(param ?? "");
  const year = match ? Number(match[1]) : Number(today.slice(0, 4));
  const month = match ? Number(match[2]) : Number(today.slice(5, 7));
  const next = month === 12 ? monthKey(year + 1, 1) : monthKey(year, month + 1);
  const previous = month === 1 ? monthKey(year - 1, 12) : monthKey(year, month - 1);
  return { year, month, key: monthKey(year, month), from: `${monthKey(year, month)}-01`, to: `${next}-01`, previous, next };
}
