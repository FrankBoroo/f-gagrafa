"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createRoom, deleteRoom, setRoomActive, setRoomDoorCode } from "@/app/admin/rooms/actions";
import { roomLabel } from "@/lib/booking/room-assignment";
import { formatDateTime } from "@/lib/format";

interface RoomRow {
  id: string;
  number: number;
  unit_id: string;
  unit_name: string;
  is_active: boolean;
  last_cleaned_at: string | null;
  door_code: string;
}

function DoorCodeEditor({ room }: { room: RoomRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(room.door_code);
  const dirty = value.trim() !== room.door_code;

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await setRoomDoorCode({ roomId: room.id, code: value });
      if (!result.ok) {
        toast.error(("error" in result && result.error) || "Something went wrong");
        return;
      }
      toast.success(`${roomLabel(room.number)} door code saved`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="flex items-center gap-2">
      <label htmlFor={`code-${room.id}`} className="sr-only">Door code for {roomLabel(room.number)}</label>
      <input
        id={`code-${room.id}`}
        value={value}
        maxLength={40}
        autoComplete="off"
        onChange={(e) => setValue(e.target.value)}
        className="min-h-11 w-32 rounded-lg border border-navy/15 px-3 py-2 text-sm"
      />
      <button type="submit" disabled={isPending || !dirty} className="btn-secondary min-h-11 px-4 py-2 text-xs">
        Save
      </button>
    </form>
  );
}

export function RoomsManager({
  rooms,
  units,
  isAdmin,
}: {
  rooms: RoomRow[];
  units: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [number, setNumber] = useState("");
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(number);
    run(() => createRoom({ number: n, unit_id: unitId }), `${roomLabel(n)} added`);
    setNumber("");
  }

  return (
    <div className="space-y-6">
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-navy/10 text-xs uppercase tracking-widest text-navy/50">
            <tr>
              <th className="px-5 py-3 font-normal">Room</th>
              <th className="px-5 py-3 font-normal">Type</th>
              <th className="px-5 py-3 font-normal">Last cleaned</th>
              <th className="px-5 py-3 font-normal">Door code</th>
              <th className="px-5 py-3 font-normal">Status</th>
              {isAdmin && <th className="px-5 py-3 font-normal"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {rooms.map((r: RoomRow) => (
              <tr key={r.id} className="border-b border-navy/5 last:border-0">
                <td className="px-5 py-3 text-navy">{roomLabel(r.number)}</td>
                <td className="px-5 py-3 text-navy/70">{r.unit_name}</td>
                <td className="px-5 py-3 text-navy/70">{r.last_cleaned_at ? formatDateTime(r.last_cleaned_at) : "Not yet"}</td>
                <td className="px-5 py-3"><DoorCodeEditor key={`${r.id}:${r.door_code}`} room={r} /></td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs ${r.is_active ? "bg-emerald-100 text-emerald-700" : "bg-navy/10 text-navy/60"}`}>
                    {r.is_active ? "In use" : "Switched off"}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => run(() => setRoomActive(r.id, !r.is_active), `${roomLabel(r.number)} ${r.is_active ? "switched off" : "back in use"}`)}
                        className="btn-secondary min-h-11 px-4 py-2 text-xs"
                      >
                        {r.is_active ? "Switch off" : "Switch on"}
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => run(() => deleteRoom(r.id), `${roomLabel(r.number)} deleted`)}
                        className="min-h-11 px-3 text-xs text-red-700 underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!rooms.length && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-5 py-8 text-center text-navy/60">No rooms yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <form onSubmit={add} className="card flex flex-wrap items-end gap-4 p-5">
          <div>
            <label htmlFor="room-number" className="text-sm text-navy/60">Room number</label>
            <input
              id="room-number"
              type="number"
              min={1}
              max={999}
              step={1}
              required
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="mt-2 block w-32 rounded-lg border border-navy/15 px-4 py-3"
            />
          </div>
          <div>
            <label htmlFor="room-type" className="text-sm text-navy/60">Apartment type</label>
            <select
              id="room-type"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="mt-2 block rounded-lg border border-navy/15 px-4 py-3"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={isPending || !unitId} className="btn-primary min-h-11 px-5 py-2.5 text-sm">
            Add room
          </button>
        </form>
      )}
    </div>
  );
}
