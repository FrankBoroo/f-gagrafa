"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateAirbnbBooking } from "@/app/admin/rooms/actions";
import { asResult } from "@/lib/action-result";
import { roomLabel } from "@/lib/booking/room-assignment";
import { formatDate } from "@/lib/format";

export interface AirbnbBookingRow {
  id: string;
  room_number: number;
  check_in: string;
  check_out: string;
  guest_name: string;
  notes: string;
  clashes: { bookingId: string; bookingCode: string }[];
}

function AirbnbBookingCard({ row }: { row: AirbnbBookingRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(row.guest_name);
  const [notes, setNotes] = useState(row.notes);
  const dirty = name.trim() !== row.guest_name || notes.trim() !== row.notes;

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = asResult(await updateAirbnbBooking({ id: row.id, guest_name: name, notes }));
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="rounded-full bg-champagne/30 px-2.5 py-0.5 text-xs text-navy">{roomLabel(row.room_number)}</span>
        <span className="text-sm text-navy">
          {formatDate(row.check_in)} → {formatDate(row.check_out)}
        </span>
        <span className="rounded-full border border-navy/20 px-2.5 py-0.5 text-xs text-navy/60">Airbnb</span>
        {row.clashes.map((c) => (
          <Link
            key={c.bookingId}
            href={`/admin/bookings/${c.bookingId}`}
            className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs text-red-800 underline"
          >
            Clashes with {c.bookingCode}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`name-${row.id}`} className="text-sm text-navy/60">Guest name</label>
          <input
            id={`name-${row.id}`}
            value={name}
            maxLength={120}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-navy/15 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={`notes-${row.id}`} className="text-sm text-navy/60">Notes</label>
          <textarea
            id={`notes-${row.id}`}
            value={notes}
            maxLength={1000}
            rows={2}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-navy/15 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button type="submit" disabled={isPending || !dirty} className="btn-primary min-h-11 px-5 py-2 text-xs">
        Save
      </button>
    </form>
  );
}

export function AirbnbBookings({ rows }: { rows: AirbnbBookingRow[] }) {
  if (!rows.length) {
    return (
      <div className="card p-8 text-center text-sm text-navy/60">
        No current or upcoming Airbnb bookings. Connect each room&apos;s Airbnb calendar on the Rooms page.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {rows.map((r: AirbnbBookingRow) => (
        <AirbnbBookingCard key={`${r.id}:${r.guest_name}:${r.notes}`} row={r} />
      ))}
    </div>
  );
}
