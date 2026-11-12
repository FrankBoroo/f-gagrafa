import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { addDays, toISODate } from "@/lib/booking/dates";
import { ATTENTION_MARKERS, buildToday, type TodayBooking } from "@/lib/admin/today";
import { CANCELLATION_REQUEST_PREFIX } from "@/lib/admin/inbox";
import { TodayNumbers } from "@/components/admin/today/TodayNumbers";
import { AttentionList } from "@/components/admin/today/AttentionList";
import { MovementList } from "@/components/admin/today/MovementList";
import { RoomTiles } from "@/components/admin/today/RoomTiles";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const BOOKING_FIELDS =
  "id, booking_code, guest_name, room_id, room_confirmed, check_in, check_out, status, payment_status, total_amount, currency, admin_notes, attention_cleared_at, units(name), rooms(number), payments(amount, status)";

function greeting(now: Date): string {
  const hour = now.getUTCHours(); // Ghana is UTC+0
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Rows from Supabase, shaped for buildToday. Net paid = successful payments plus refund rows (negative).
function toTodayBooking(b: any): TodayBooking {
  const netPaid = (b.payments ?? [])
    .filter((p: any) => p.status === "success" || p.status === "refunded")
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  return {
    id: b.id,
    booking_code: b.booking_code,
    guest_name: b.guest_name,
    unit_name: b.units?.name ?? "Apartment",
    room_id: b.room_id,
    room_number: b.rooms?.number ?? null,
    room_confirmed: Boolean(b.room_confirmed),
    check_in: b.check_in,
    check_out: b.check_out,
    status: b.status,
    payment_status: b.payment_status,
    total_amount: Number(b.total_amount),
    net_paid: netPaid,
    currency: b.currency ?? "GHS",
    admin_notes: b.admin_notes,
    attention_cleared_at: b.attention_cleared_at,
  };
}

export default async function AdminTodayPage() {
  const supabase = createServiceClient();
  const now = new Date();
  const today = toISODate(now);
  // Quoted, because the markers contain spaces (PostgREST logic-tree syntax).
  const markerFilter = ATTENTION_MARKERS.map((m) => `admin_notes.ilike."%${m.marker}%"`).join(",");

  const [profile, { data: recent }, { data: flagged }, { data: rooms }, { data: requests }] = await Promise.all([
    getCurrentProfile(),
    supabase
      .from("bookings")
      .select(BOOKING_FIELDS)
      .gte("check_out", addDays(today, -30))
      .not("status", "in", "(cancelled,no_show)"),
    supabase.from("bookings").select(BOOKING_FIELDS).is("attention_cleared_at", null).or(markerFilter),
    supabase.from("rooms").select("id, number, last_cleaned_at, units(name)").eq("is_active", true).order("number"),
    supabase
      .from("service_requests")
      .select("id, booking_id, created_at, bookings(booking_code)")
      .in("status", ["pending", "in_progress"])
      .ilike("description", `${CANCELLATION_REQUEST_PREFIX}%`),
  ]);

  const byId = new Map<string, TodayBooking>();
  for (const row of [...(recent ?? []), ...(flagged ?? [])]) byId.set(row.id, toTodayBooking(row));
  const bookings = [...byId.values()];

  const view = buildToday({
    today,
    bookings,
    rooms: (rooms ?? []).map((r: any) => ({
      id: r.id,
      number: r.number,
      unit_name: r.units?.name ?? "",
      last_cleaned_at: r.last_cleaned_at,
    })),
    cancellationRequests: (requests ?? []).map((r: any) => ({
      bookingId: r.booking_id,
      bookingCode: r.bookings?.booking_code ?? "",
      createdAt: r.created_at,
    })),
  });

  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{WEEKDAYS[now.getUTCDay()]} {formatDate(today)}</p>
          <h1 className="mt-1 text-3xl">
            {greeting(now)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/availability" className="btn-secondary min-h-11 px-5 py-2.5 text-sm">Block dates</Link>
          <Link href="/admin/bookings/new" className="btn-primary min-h-11 px-5 py-2.5 text-sm">+ New booking</Link>
        </div>
      </header>

      <TodayNumbers view={view} />

      <section className="card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl">Needs attention</h2>
          {view.attention.length > 0 && (
            <span className="text-sm text-navy/60">
              {view.attention.length} item{view.attention.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="mt-2">
          <AttentionList items={view.attention} bookings={Object.fromEntries(byId)} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <MovementList title="Arriving today" bookings={view.arriving} empty="No arrivals today." />
        <MovementList title="Leaving today" bookings={view.leaving} empty="No departures today." />
      </div>

      <section className="card p-5">
        <h2 className="text-xl">Rooms</h2>
        <p className="mt-1 text-sm text-navy/60">Tap &ldquo;Mark cleaned&rdquo; when housekeeping has finished a room.</p>
        <div className="mt-4">
          <RoomTiles rooms={view.rooms} />
        </div>
      </section>
    </div>
  );
}
