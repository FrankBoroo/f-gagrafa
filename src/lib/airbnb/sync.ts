import type { createServiceClient } from "@/lib/supabase/server";
import { toISODate } from "@/lib/booking/dates";
import { log } from "@/lib/logger";
import { sendAdminSystemAlert } from "@/lib/notify/email";
import { parseAirbnbIcs } from "./parse";
import { airbnbCalendarUrlProblem } from "./url";

type ServiceClient = ReturnType<typeof createServiceClient>;

export interface SyncRoomInput {
  id: string;
  number: number;
  airbnb_ical_url: string | null;
  airbnb_sync_error: string | null;
}
export type SyncRoomResult =
  | { ok: true; added: number; updated: number; removed: number }
  | { ok: false; error: string };

const MAX_BODY_CHARS = 1_000_000;
const FETCH_TIMEOUT_MS = 10_000;

interface ExistingRow {
  id: string;
  uid: string;
  check_in: string;
  check_out: string;
  removed_at: string | null;
}

async function fail(
  supabase: ServiceClient,
  room: SyncRoomInput,
  error: string,
  err?: unknown,
): Promise<{ ok: false; error: string }> {
  // Never log the import URL: it carries Airbnb's secret.
  log.error("airbnb.sync_failed", { room: room.number }, err);
  try {
    await supabase.from("rooms").update({ airbnb_sync_error: error }).eq("id", room.id);
  } catch (e) {
    log.error("airbnb.sync_error_save_failed", { room: room.number }, e);
  }
  if (!room.airbnb_sync_error) {
    try {
      await sendAdminSystemAlert("airbnb.sync_failed", `Airbnb calendar sync failed for room ${room.number}`, {
        room: room.number,
        error,
      });
    } catch {
      // best-effort
    }
  }
  return { ok: false, error };
}

/** Brings the room's imported Airbnb reservations in line with its calendar feed. Never throws. */
export async function syncRoom(
  supabase: ServiceClient,
  room: SyncRoomInput,
  opts: { fetchImpl?: typeof fetch; now: Date },
): Promise<SyncRoomResult> {
  try {
    const url = room.airbnb_ical_url;
    if (!url) return await fail(supabase, room, "No Airbnb calendar link is set for this room.");
    const problem = airbnbCalendarUrlProblem(url);
    if (problem) return await fail(supabase, room, problem);

    let body: string;
    try {
      const res = await (opts.fetchImpl ?? fetch)(url, {
        redirect: "error",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) return await fail(supabase, room, `Airbnb answered with an error (${res.status}).`);
      body = await res.text();
    } catch (err) {
      return await fail(supabase, room, "Could not reach Airbnb. It will be tried again.", err);
    }
    if (body.length > MAX_BODY_CHARS) {
      return await fail(supabase, room, "The Airbnb calendar was too large to read.");
    }

    const parsed = parseAirbnbIcs(body);
    if (!parsed.ok) return await fail(supabase, room, parsed.error);

    const nowIso = opts.now.toISOString();
    const today = toISODate(opts.now);

    const { data, error: readError } = await supabase
      .from("external_reservations")
      .select("id, uid, check_in, check_out, removed_at")
      .eq("room_id", room.id);
    if (readError) return await fail(supabase, room, "Could not read the saved reservations.", readError);
    const existing = new Map<string, ExistingRow>((data ?? []).map((r: ExistingRow) => [r.uid, r]));

    let added = 0;
    let updated = 0;
    const seen = new Set<string>();
    const upserts = parsed.reservations.map((r) => {
      seen.add(r.uid);
      const prev = existing.get(r.uid);
      if (!prev) added += 1;
      else if (prev.check_in !== r.checkIn || prev.check_out !== r.checkOut || prev.removed_at) updated += 1;
      return {
        room_id: room.id,
        source: "airbnb" as const,
        uid: r.uid,
        check_in: r.checkIn,
        check_out: r.checkOut,
        summary: r.summary,
        last_seen_at: nowIso,
        removed_at: null,
      };
    });

    if (upserts.length > 0) {
      const { error } = await supabase.from("external_reservations").upsert(upserts, { onConflict: "room_id,uid" });
      if (error) return await fail(supabase, room, "Could not save the Airbnb reservations.", error);
    }

    const missing: string[] = [];
    for (const row of existing.values()) {
      if (!seen.has(row.uid) && !row.removed_at && row.check_out >= today) missing.push(row.id);
    }
    if (missing.length > 0) {
      const { error } = await supabase.from("external_reservations").update({ removed_at: nowIso }).in("id", missing);
      if (error) return await fail(supabase, room, "Could not mark cancelled Airbnb reservations.", error);
    }

    await supabase.from("rooms").update({ airbnb_synced_at: nowIso, airbnb_sync_error: null }).eq("id", room.id);
    return { ok: true, added, updated, removed: missing.length };
  } catch (err) {
    return await fail(supabase, room, "The Airbnb sync hit an unexpected problem.", err);
  }
}

/** Syncs every room that has an import link (optionally one type, optionally only stale ones). Never throws. */
export async function syncRooms(
  supabase: ServiceClient,
  opts: { unitId?: string; olderThanMinutes?: number; timeoutMs?: number; now: Date; fetchImpl?: typeof fetch },
): Promise<{ synced: number; failed: number }> {
  const counts = { synced: 0, failed: 0 };
  try {
    let query = supabase
      .from("rooms")
      .select("id, number, airbnb_ical_url, airbnb_sync_error")
      .not("airbnb_ical_url", "is", null);
    if (opts.unitId) query = query.eq("unit_id", opts.unitId);
    if (opts.olderThanMinutes !== undefined) {
      const cutoff = new Date(opts.now.getTime() - opts.olderThanMinutes * 60_000).toISOString();
      query = query.or(`airbnb_synced_at.is.null,airbnb_synced_at.lt.${cutoff}`);
    }
    const { data, error } = await query;
    if (error) {
      log.error("airbnb.sync_rooms_failed", {}, error);
      return counts;
    }
    const all = Promise.all(
      (data ?? []).map(async (r: SyncRoomInput) => {
        const res = await syncRoom(supabase, r, { fetchImpl: opts.fetchImpl, now: opts.now });
        if (res.ok) counts.synced += 1;
        else counts.failed += 1;
      }),
    );
    if (opts.timeoutMs === undefined) {
      await all;
    } else {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<void>((resolve: () => void) => {
        timer = setTimeout(resolve, opts.timeoutMs);
      });
      await Promise.race([all, timeout]);
      if (timer) clearTimeout(timer);
    }
  } catch (err) {
    log.error("airbnb.sync_rooms_failed", {}, err);
  }
  return { ...counts };
}
