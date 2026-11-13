import { createServiceClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth";
import { toISODate } from "@/lib/booking/dates";
import { findClashes } from "@/lib/airbnb/clashes";
import { AirbnbBookings, type AirbnbBookingRow } from "@/components/admin/AirbnbBookings";

export default async function AdminAirbnbBookingsPage() {
  if (!(await isStaff())) {
    return (
      <div>
        <h1 className="text-3xl">Airbnb bookings</h1>
        <p className="mt-4 text-sm text-navy/50">Only staff can view Airbnb bookings.</p>
      </div>
    );
  }

  const today = toISODate(new Date());
  const supabase = createServiceClient();
  const [{ data: external }, { data: bookings }] = await Promise.all([
    supabase
      .from("external_reservations")
      .select("id, room_id, check_in, check_out, guest_name, notes, rooms(number)")
      .is("removed_at", null)
      .gte("check_out", today)
      .order("check_in")
      .order("check_out"),
    supabase
      .from("bookings")
      .select("id, booking_code, guest_name, room_id, check_in, check_out, status, payment_status")
      .not("room_id", "is", null)
      .not("status", "in", "(cancelled,no_show)")
      .gte("check_out", today),
  ]);

  const stays = (external ?? []).map((e: any) => ({
    id: e.id as string,
    room_id: e.room_id as string,
    check_in: e.check_in as string,
    check_out: e.check_out as string,
    guest_name: (e.guest_name ?? null) as string | null,
  }));
  const clashes = findClashes(stays, bookings ?? [], today);

  const rows: AirbnbBookingRow[] = (external ?? []).map((e: any) => ({
    id: e.id,
    room_number: e.rooms?.number ?? 0,
    check_in: e.check_in,
    check_out: e.check_out,
    guest_name: e.guest_name ?? "",
    notes: e.notes ?? "",
    clashes: clashes.filter((c) => c.externalId === e.id).map((c) => ({ bookingId: c.bookingId, bookingCode: c.bookingCode })),
  }));

  return (
    <div>
      <h1 className="text-3xl">Airbnb bookings</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy/50">
        Current and upcoming reservations imported from Airbnb, by check-in. Airbnb only shares the dates, so add the
        guest&apos;s name and any notes here; they are kept when the calendar syncs.
      </p>
      <div className="mt-8">
        <AirbnbBookings rows={rows} />
      </div>
    </div>
  );
}
