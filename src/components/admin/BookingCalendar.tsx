"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthYear } from "@/lib/format";
import type { CalendarSegment, RoomRow } from "@/lib/admin/room-calendar";

const SEGMENT_STYLE: Record<string, string> = {
  confirmed: "bg-navy text-ivory",
  pencilled: "border border-navy bg-white text-navy",
  hold: "bg-sand text-navy/80",
  block: "bg-navy/10 text-navy/60 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(20,33,61,.08)_4px,rgba(20,33,61,.08)_8px)]",
};

function styleFor(s: CalendarSegment): string {
  if (s.kind === "block") return SEGMENT_STYLE.block;
  if (s.kind === "hold") return SEGMENT_STYLE.hold;
  return s.confirmed ? SEGMENT_STYLE.confirmed : SEGMENT_STYLE.pencilled;
}

// One row per room, one column per day. On a phone the grid scrolls sideways inside
// the card; the room names stay put on the left.
export function BookingCalendar({ year, month, rows }: { year: number; month: number; rows: RoomRow[] }) {
  const router = useRouter();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const columns = `repeat(${daysInMonth}, minmax(2rem, 1fr))`;

  function navigate(delta: number) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    router.push(`/admin/calendar?year=${d.getUTCFullYear()}&month=${d.getUTCMonth() + 1}`);
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="min-h-11 min-w-11 rounded-lg p-2 hover:bg-navy/5" aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <p className="text-lg">{formatMonthYear(year, month)}</p>
        <button onClick={() => navigate(1)} className="min-h-11 min-w-11 rounded-lg p-2 hover:bg-navy/5" aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      {rows.length ? (
        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[56rem] text-xs">
            <div className="flex border-b border-navy/10">
              <div className="sticky left-0 z-10 w-36 shrink-0 bg-white py-2 font-medium text-navy/50">Room</div>
              <div className="grid flex-1" style={{ gridTemplateColumns: columns }}>
                {days.map((d) => (
                  <div key={d} className="py-2 text-center text-navy/40">{d}</div>
                ))}
              </div>
            </div>
            {rows.map((row) => (
              <div key={row.roomId} className="flex border-b border-navy/5">
                <div className="sticky left-0 z-10 w-36 shrink-0 bg-white py-2 pr-2">
                  <p className="text-sm text-navy">{row.label}</p>
                  <p className="truncate text-[11px] text-navy/50">{row.unitName}</p>
                </div>
                <div className="grid flex-1 items-center py-1.5" style={{ gridTemplateColumns: columns }}>
                  {row.segments.map((s) => {
                    const className = `mx-px block truncate rounded px-1.5 py-1 text-[11px] ${styleFor(s)}`;
                    const style = { gridColumn: `${s.startDay} / ${s.endDay + 1}`, gridRow: 1 };
                    return s.href ? (
                      <Link key={`${s.kind}-${s.id}`} href={s.href} className={`${className} hover:opacity-90`} style={style} title={s.label}>
                        {s.label}
                      </Link>
                    ) : (
                      <span key={`${s.kind}-${s.id}`} className={className} style={style} title={s.label}>
                        {s.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm text-navy/60">No rooms yet. Add them in Apartments → Rooms.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-navy/60">
        <Legend className={SEGMENT_STYLE.confirmed} label="Room confirmed" />
        <Legend className={SEGMENT_STYLE.pencilled} label="Room pencilled in" />
        <Legend className={SEGMENT_STYLE.hold} label="Unpaid checkout" />
        <Legend className={SEGMENT_STYLE.block} label="Blocked" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-5 rounded ${className}`} aria-hidden /> {label}
    </span>
  );
}
