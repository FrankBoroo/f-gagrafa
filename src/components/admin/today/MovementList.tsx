import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { calculateNights } from "@/lib/booking/dates";
import { roomLabel } from "@/lib/booking/room-assignment";
import { balanceOwed, type TodayBooking } from "@/lib/admin/today";
import type { ExternalStay } from "@/lib/airbnb/clashes";

// Arriving or leaving today, with what each guest still owes. Airbnb stays are listed
// after the website ones: guest name, room and nights, no money (Airbnb handles payment).
export function MovementList({
  title,
  bookings,
  external = [],
  roomNumbers = {},
  empty,
}: {
  title: string;
  bookings: TodayBooking[];
  external?: ExternalStay[];
  roomNumbers?: Record<string, number>;
  empty: string;
}) {
  return (
    <section className="card p-5">
      <h2 className="text-xl">{title}</h2>
      {bookings.length || external.length ? (
        <ul className="mt-3 divide-y divide-sand">
          {bookings.map((b: TodayBooking) => {
            const owed = balanceOwed(b);
            const nights = calculateNights(b.check_in, b.check_out);
            return (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href={`/admin/bookings?q=${encodeURIComponent(b.booking_code)}`} className="font-medium text-navy hover:underline">
                    {b.guest_name}
                  </Link>
                  <p className="text-xs text-navy/60">
                    {roomLabel(b.room_number)}
                    {!b.room_confirmed && b.room_number !== null ? " (pencilled in)" : ""} · {b.unit_name} · {nights} night{nights === 1 ? "" : "s"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${owed > 0 ? "bg-amber-100 text-amber-800" : "bg-sand text-navy/70"}`}
                >
                  {owed > 0 ? `Owes ${formatMoney(owed, b.currency)}` : "Paid"}
                </span>
              </li>
            );
          })}
          {external.map((e: ExternalStay) => {
            const nights = calculateNights(e.check_in, e.check_out);
            return (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href="/admin/bookings/airbnb" className="font-medium text-navy hover:underline">
                    {e.guest_name ?? "Airbnb booking"}
                  </Link>
                  <p className="text-xs text-navy/60">
                    {roomLabel(roomNumbers[e.room_id])} · {nights} night{nights === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-sand px-2.5 py-0.5 text-xs text-navy/70">Airbnb</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-navy/60">{empty}</p>
      )}
    </section>
  );
}
