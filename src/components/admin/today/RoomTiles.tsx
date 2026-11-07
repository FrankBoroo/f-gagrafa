"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { markRoomCleaned } from "@/app/admin/today/actions";
import { roomLabel } from "@/lib/booking/room-assignment";
import type { RoomStatus, TodayView } from "@/lib/admin/today";

const STATUS: Record<RoomStatus, { label: string; dot: string }> = {
  occupied: { label: "Occupied", dot: "bg-navy" },
  needs_cleaning: { label: "Needs cleaning", dot: "bg-red-700" },
  ready: { label: "Ready", dot: "bg-emerald-700" },
  free: { label: "Free", dot: "bg-champagne" },
};

export function RoomTiles({ rooms }: { rooms: TodayView["rooms"] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function cleaned(roomId: string, number: number) {
    startTransition(async () => {
      const result = await markRoomCleaned(roomId);
      if (!result.ok) {
        toast.error(result.error ?? "Could not update the room");
        return;
      }
      toast.success(`${roomLabel(number)} marked cleaned`);
      router.refresh();
    });
  }

  if (!rooms.length) {
    return <p className="text-sm text-navy/60">No rooms yet. Add them in Apartments → Rooms.</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {rooms.map(({ room, status }) => (
        <li key={room.id} className="rounded-lg border border-sand bg-white p-3">
          <p className="font-display text-lg text-navy">{roomLabel(room.number)}</p>
          <p className="truncate text-xs text-navy/60">{room.unit_name}</p>
          <p className="mt-2 flex items-center text-xs text-navy">
            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${STATUS[status].dot}`} aria-hidden />
            {STATUS[status].label}
          </p>
          {status === "needs_cleaning" && (
            <button
              type="button"
              onClick={() => cleaned(room.id, room.number)}
              disabled={isPending}
              className="btn-secondary mt-2 min-h-11 w-full px-2 py-2 text-xs"
            >
              Mark cleaned
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
