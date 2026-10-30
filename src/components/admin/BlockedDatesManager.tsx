"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { addBlockedDate, removeBlockedDate } from "@/app/admin/availability/actions";
import type { Tables } from "@/types/database";
import { EmptyState } from "@/components/ui/EmptyState";

type BlockedDate = Tables<"blocked_dates">;

interface RoomOption {
  id: string;
  number: number;
  units: { name: string } | null;
}

function roomLabel(room: RoomOption) {
  return `Room ${room.number} · ${room.units?.name ?? "Unknown type"}`;
}

export function BlockedDatesManager({
  rooms, units, blocks,
}: {
  rooms: RoomOption[];
  units: { id: string; name: string }[];
  blocks: BlockedDate[];
}) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  // A block without a room covers every room of its type.
  function blockLabel(block: BlockedDate) {
    const room = rooms.find((r) => r.id === block.room_id);
    if (room) return roomLabel(room);
    return `All ${units.find((u) => u.id === block.unit_id)?.name ?? "Unknown type"} rooms`;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await addBlockedDate({ room_id: roomId, start_date: startDate, end_date: endDate, reason });
      if (!result.ok) {
        toast.error(result.error ?? "Could not add block");
        return;
      }
      toast.success("Dates blocked");
      setStartDate("");
      setEndDate("");
      setReason("");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removeBlockedDate(id);
      if (!result.ok) {
        toast.error(result.error ?? "Could not remove block");
        return;
      }
      toast.success("Block removed");
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={submit} className="card space-y-4 p-6">
        <h2 className="text-lg">Block dates</h2>
        <div>
          <label className="text-sm text-navy/60">Room</label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-navy/15 px-3 py-2.5 text-sm"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{roomLabel(r)}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-navy/60">From</label>
            <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-2 w-full rounded-lg border border-navy/15 px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-sm text-navy/60">To</label>
            <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-2 w-full rounded-lg border border-navy/15 px-3 py-2.5 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-sm text-navy/60">Reason (optional)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Maintenance, owner stay, etc." className="mt-2 w-full rounded-lg border border-navy/15 px-3 py-2.5 text-sm" />
        </div>
        <button className="btn-primary w-full" disabled={isPending || !roomId}>
          {isPending ? "Saving…" : "Block these dates"}
        </button>
      </form>

      <div className="card p-6">
        <h2 className="text-lg">Currently blocked</h2>
        <div className="mt-4 space-y-3">
          {blocks.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-navy/10 px-4 py-3 text-sm">
              <div>
                <p>{blockLabel(b)}</p>
                <p className="text-navy/50">{b.start_date} → {b.end_date}{b.reason ? ` · ${b.reason}` : ""}</p>
              </div>
              <button onClick={() => remove(b.id)} className="rounded-lg p-2 text-navy/40 hover:bg-red-50 hover:text-red-600" disabled={isPending} aria-label="Remove block">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {!blocks.length && <EmptyState compact title="No blocked dates" description="Every room is open for booking." />}
        </div>
      </div>
    </div>
  );
}
