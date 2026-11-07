"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changeRoom, confirmRoom, roomChoices } from "@/app/admin/bookings/actions";
import { roomAssignmentError, roomLabel } from "@/lib/booking/room-assignment";
import type { FreeRoom } from "@/lib/booking/rooms";

interface Props {
  booking: { id: string; room_number: number | null; room_confirmed: boolean; status: string; payment_status: string };
}

// The booking's room, pencilled in or confirmed, with Confirm and Change.
// Change lists only rooms of the same type that are free for the whole stay.
export function RoomAssignment({ booking }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [choices, setChoices] = useState<FreeRoom[] | null>(null);
  const [picked, setPicked] = useState("");
  const locked = roomAssignmentError(booking) !== null;
  const hasRoom = typeof booking.room_number === "number";

  function confirm() {
    startTransition(async () => {
      const result = await confirmRoom(booking.id);
      if (!result.ok) {
        toast.error(result.error ?? "Could not confirm the room");
        return;
      }
      toast.success(`${roomLabel(booking.room_number)} confirmed`);
      router.refresh();
    });
  }

  function openChange() {
    startTransition(async () => {
      const result = await roomChoices(booking.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setChoices(result.rooms);
      setPicked(result.rooms.find((r: FreeRoom) => r.id === result.currentRoomId)?.id ?? result.rooms[0]?.id ?? "");
    });
  }

  function save() {
    if (!picked) return;
    startTransition(async () => {
      const result = await changeRoom({ bookingId: booking.id, roomId: picked });
      if (!result.ok) {
        toast.error(result.error ?? "Could not change the room");
        return;
      }
      const room = choices?.find((r: FreeRoom) => r.id === picked);
      toast.success(`Moved to ${roomLabel(room?.number)}`);
      setChoices(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-navy">{roomLabel(booking.room_number)}</span>
      {hasRoom && (
        <span className={`rounded-full px-2.5 py-0.5 text-xs ${booking.room_confirmed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {booking.room_confirmed ? "confirmed" : "pencilled in"}
        </span>
      )}
      {!locked && choices === null && (
        <>
          {hasRoom && !booking.room_confirmed && (
            <button type="button" onClick={confirm} disabled={isPending} className="btn-primary min-h-11 px-4 py-2 text-xs">
              Confirm
            </button>
          )}
          <button type="button" onClick={openChange} disabled={isPending} className="btn-secondary min-h-11 px-4 py-2 text-xs">
            Change
          </button>
        </>
      )}
      {choices !== null && (
        <span className="flex flex-wrap items-center gap-2">
          {choices.length ? (
            <>
              <label className="sr-only" htmlFor={`room-${booking.id}`}>Room</label>
              <select
                id={`room-${booking.id}`}
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
                className="min-h-11 rounded-lg border border-navy/15 px-3"
              >
                {choices.map((r: FreeRoom) => (
                  <option key={r.id} value={r.id}>{roomLabel(r.number)}</option>
                ))}
              </select>
              <button type="button" onClick={save} disabled={isPending || !picked} className="btn-primary min-h-11 px-4 py-2 text-xs">
                Save
              </button>
            </>
          ) : (
            <span className="text-navy/60">No other room of this type is free for the whole stay.</span>
          )}
          <button type="button" onClick={() => setChoices(null)} className="min-h-11 px-3 text-xs text-navy/60 underline">
            Cancel
          </button>
        </span>
      )}
    </div>
  );
}
