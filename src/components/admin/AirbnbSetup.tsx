"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { newRoomExportLink, setRoomAirbnbUrl, syncAirbnbNow } from "@/app/admin/rooms/actions";
import { asResult } from "@/lib/action-result";
import { roomLabel } from "@/lib/booking/room-assignment";
import { formatDateTime } from "@/lib/format";

export interface AirbnbRoom {
  id: string;
  number: number;
  has_link: boolean;
  synced_at: string | null;
  sync_error: string | null;
  // Only filled for admins: both are secrets.
  import_url: string;
  export_link: string;
}

function SyncStatus({ room }: { room: AirbnbRoom }) {
  if (room.sync_error) {
    return <p className="text-sm text-red-700">Last sync failed: {room.sync_error}</p>;
  }
  if (!room.has_link) return <p className="text-sm text-navy/50">No Airbnb link yet.</p>;
  return (
    <p className="text-sm text-navy/60">
      {room.synced_at ? `Last synced ${formatDateTime(room.synced_at)}` : "Not synced yet."}
    </p>
  );
}

function RoomAirbnb({ room, isAdmin }: { room: AirbnbRoom; isAdmin: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [url, setUrl] = useState(room.import_url);
  const [confirmingNew, setConfirmingNew] = useState(false);
  const dirty = url.trim() !== room.import_url;

  function run(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      const result = asResult(await action());
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        router.refresh();
        return;
      }
      toast.success(success);
      setConfirmingNew(false);
      router.refresh();
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(room.export_link);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it by hand.");
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-lg text-navy">{roomLabel(room.number)}</h3>
          <SyncStatus room={room} />
        </div>
        {room.has_link && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => syncAirbnbNow(room.id), `${roomLabel(room.number)} synced`)}
            className="btn-secondary min-h-11 px-4 py-2 text-xs"
          >
            Sync now
          </button>
        )}
      </div>

      {isAdmin && (
        <>
          <div>
            <p className="text-sm text-navy/60">Our calendar link (give this to Airbnb)</p>
            <p className="mt-1 break-all rounded-lg bg-sand/40 px-3 py-2 text-xs text-navy/80">{room.export_link}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={copy} className="btn-secondary min-h-11 px-4 py-2 text-xs">Copy link</button>
              {!confirmingNew ? (
                <button
                  type="button"
                  onClick={() => setConfirmingNew(true)}
                  className="min-h-11 px-3 text-xs text-navy/70 underline"
                >
                  New link
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  <span>The old link stops working at once. Airbnb must be given the new one, or it will stop seeing our bookings.</span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => newRoomExportLink(room.id), "New link created")}
                    className="min-h-11 rounded-lg bg-red-700 px-4 py-2 text-white"
                  >
                    Yes, make a new link
                  </button>
                  <button type="button" onClick={() => setConfirmingNew(false)} className="min-h-11 px-3 underline">Keep it</button>
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={(e: React.FormEvent) => {
              e.preventDefault();
              run(() => setRoomAirbnbUrl({ roomId: room.id, url }), url.trim() ? "Link saved and synced" : "Airbnb link removed");
            }}
          >
            <label htmlFor={`airbnb-${room.id}`} className="text-sm text-navy/60">Airbnb calendar link (from Airbnb)</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                id={`airbnb-${room.id}`}
                value={url}
                maxLength={2000}
                autoComplete="off"
                spellCheck={false}
                placeholder="https://www.airbnb.com/calendar/ical/…"
                onChange={(e) => setUrl(e.target.value)}
                className="min-h-11 min-w-0 flex-1 basis-64 rounded-lg border border-navy/15 px-3 py-2 text-sm"
              />
              <button type="submit" disabled={isPending || !dirty} className="btn-primary min-h-11 px-5 py-2 text-xs">
                Save
              </button>
            </div>
            <p className="mt-1 text-xs text-navy/50">Leave it empty and save to disconnect this room.</p>
          </form>
        </>
      )}
    </div>
  );
}

export function AirbnbSetup({ rooms, isAdmin }: { rooms: AirbnbRoom[]; isAdmin: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const anyLinked = rooms.some((r) => r.has_link);

  function syncAll() {
    startTransition(async () => {
      const result = asResult(await syncAirbnbNow());
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
      } else {
        toast.success("Airbnb calendars synced");
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-4" aria-labelledby="airbnb-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="airbnb-heading" className="text-2xl">Airbnb</h2>
        {anyLinked && (
          <button type="button" disabled={isPending} onClick={syncAll} className="btn-secondary min-h-11 px-4 py-2 text-xs">
            Sync all rooms
          </button>
        )}
      </div>

      {isAdmin && (
        <ol className="card list-decimal space-y-2 p-5 pl-9 text-sm text-navy/70">
          <li>In Airbnb, open the listing, then Availability, then Connect calendars, then Export. Copy the link and paste it into the Airbnb calendar link box for that room below.</li>
          <li>In the same place on Airbnb, choose Import calendar, paste this room&apos;s calendar link from below, and name it &quot;The Gagrafa&quot;.</li>
          <li>Repeat for each room.</li>
        </ol>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {rooms.map((r: AirbnbRoom) => (
          <RoomAirbnb key={`${r.id}:${r.import_url}:${r.export_link}`} room={r} isAdmin={isAdmin} />
        ))}
      </div>
    </section>
  );
}
