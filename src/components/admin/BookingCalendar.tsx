"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthYear } from "@/lib/format";

interface CalendarBooking {
  id: string;
  booking_code: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  status: string;
  unit_name: string;
}

const statusDot: Record<string, string> = {
  pending: "bg-amber-400",
  confirmed: "bg-emerald-500",
  checked_in: "bg-sky-500",
  checked_out: "bg-navy/30",
  cancelled: "bg-red-400",
  no_show: "bg-red-400",
};

export function BookingCalendar({
  year, month, bookings,
}: {
  year: number;
  month: number; // 1-12
  bookings: CalendarBooking[];
}) {
  const router = useRouter();

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstDay.getDay(); // 0 = Sunday

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function bookingsForDay(day: number) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return bookings.filter((b) => b.check_in <= date && date < b.check_out);
  }

  function navigate(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    router.push(`/admin/calendar?year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
  }

  const monthLabel = formatMonthYear(year, month);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-navy/5" aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <p className="text-lg">{monthLabel}</p>
        <button onClick={() => navigate(1)} className="rounded-lg p-2 hover:bg-navy/5" aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-navy/10 text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-sand px-2 py-2 text-center font-medium text-navy/50">{d}</div>
        ))}
        {cells.map((day, i) => {
          const dayBookings = day ? bookingsForDay(day) : [];
          return (
            <div key={i} className="min-h-[90px] bg-white p-1.5 sm:min-h-[110px]">
              {day && (
                <>
                  <p className="text-xs text-navy/40">{day}</p>
                  <div className="mt-1 space-y-1">
                    {dayBookings.slice(0, 3).map((b) => (
                      <Link
                        key={b.id}
                        href={`/admin/bookings?q=${b.booking_code}`}
                        className="block truncate rounded px-1.5 py-0.5 text-[11px] text-navy/80 hover:bg-sand"
                        title={`${b.guest_name} — ${b.unit_name}`}
                      >
                        <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${statusDot[b.status] ?? "bg-navy/30"}`} />
                        {b.unit_name}
                      </Link>
                    ))}
                    {dayBookings.length > 3 && (
                      <p className="px-1.5 text-[11px] text-navy/40">+{dayBookings.length - 3} more</p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-navy/50">
        {Object.entries(statusDot).map(([status, dot]) => (
          <span key={status} className="flex items-center gap-1.5 capitalize">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} /> {status.replace("_", " ")}
          </span>
        ))}
      </div>
    </div>
  );
}
