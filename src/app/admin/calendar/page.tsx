import { createServiceClient } from "@/lib/supabase/server";
import { BookingCalendar } from "@/components/admin/BookingCalendar";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEndDate = new Date(year, month, 0);
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(monthEndDate.getDate()).padStart(2, "0")}`;

  const supabase = createServiceClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, booking_code, guest_name, check_in, check_out, status, units(name)")
    .not("status", "in", "(cancelled)")
    .lte("check_in", monthEnd)
    .gte("check_out", monthStart);

  const calendarBookings = (bookings ?? []).map((b: any) => ({
    id: b.id,
    booking_code: b.booking_code,
    guest_name: b.guest_name,
    check_in: b.check_in,
    check_out: b.check_out,
    status: b.status,
    unit_name: b.units?.name ?? "Unit",
  }));

  return (
    <div>
      <h1 className="text-3xl">Calendar</h1>
      <p className="mt-2 text-sm text-navy/50">Click a stay to jump to its booking record.</p>
      <div className="mt-8">
        <BookingCalendar year={year} month={month} bookings={calendarBookings} />
      </div>
    </div>
  );
}
