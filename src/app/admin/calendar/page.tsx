import { createServiceClient } from "@/lib/supabase/server";
import { BookingCalendar } from "@/components/admin/BookingCalendar";
import { roomCalendarRows } from "@/lib/admin/room-calendar";
import { addDays } from "@/lib/booking/dates";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const asked = { year: Number(params.year), month: Number(params.month) };
  const year = Number.isInteger(asked.year) && asked.year >= 2000 && asked.year <= 2100 ? asked.year : now.getUTCFullYear();
  const month = Number.isInteger(asked.month) && asked.month >= 1 && asked.month <= 12 ? asked.month : now.getUTCMonth() + 1;

  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${year}-${pad(month)}-01`;
  const nextMonthStart = addDays(`${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}`, 1);

  const supabase = createServiceClient();
  const [{ data: rooms }, { data: bookings }, { data: blocks }, { data: external }] = await Promise.all([
    supabase.from("rooms").select("id, number, unit_id, units(name)").eq("is_active", true).order("number"),
    supabase
      .from("bookings")
      .select("id, booking_code, guest_name, room_id, room_confirmed, check_in, check_out, status, payment_status")
      .not("room_id", "is", null)
      .not("status", "in", "(cancelled,no_show)")
      .lt("check_in", nextMonthStart)
      .gt("check_out", monthStart),
    supabase
      .from("blocked_dates")
      .select("id, unit_id, room_id, start_date, end_date, reason")
      .lt("start_date", nextMonthStart)
      .gt("end_date", monthStart),
    supabase
      .from("external_reservations")
      .select("id, room_id, check_in, check_out, guest_name")
      .is("removed_at", null)
      .lt("check_in", nextMonthStart)
      .gt("check_out", monthStart),
  ]);

  const rows = roomCalendarRows({
    year,
    month,
    rooms: (rooms ?? []).map((r: any) => ({ id: r.id, number: r.number, unit_id: r.unit_id, unit_name: r.units?.name ?? "" })),
    bookings: (bookings ?? []).map((b: any) => ({ ...b, room_confirmed: Boolean(b.room_confirmed) })),
    blocks: blocks ?? [],
    external: external ?? [],
  });

  return (
    <div>
      <h1 className="text-3xl">Calendar</h1>
      <p className="mt-2 text-sm text-navy/50">One row per room. Click a stay to open its booking. Airbnb stays are shown in outline.</p>
      <div className="mt-8">
        <BookingCalendar year={year} month={month} rows={rows} />
      </div>
    </div>
  );
}
