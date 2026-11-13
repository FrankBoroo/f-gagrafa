"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { isAdmin, isStaff, UNAUTHORIZED } from "@/lib/auth";
import { toISODate } from "@/lib/booking/dates";
import { roomLabel } from "@/lib/booking/room-assignment";
import { airbnbCalendarUrlProblem } from "@/lib/airbnb/url";
import { syncRoom, syncRooms } from "@/lib/airbnb/sync";
import { airbnbBookingSchema } from "@/lib/validations";

const roomSchema = z.object({
  number: z.number().int("Room numbers are whole numbers").min(1, "Room numbers start at 1").max(999),
  unit_id: z.string().uuid("Choose an apartment type"),
});
const id = z.string().uuid();

function refreshRoomPages() {
  revalidatePath("/admin/rooms");
  revalidatePath("/admin/units");
  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
}

async function loadRoom(supabase: ReturnType<typeof createServiceClient>, roomId: string) {
  const { data } = await supabase.from("rooms").select("id, number").eq("id", roomId).maybeSingle();
  return data;
}

export async function createRoom(input: { number: number; unit_id: string }) {
  if (!(await isAdmin())) return UNAUTHORIZED;
  const parsed = roomSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid room" };

  const supabase = createServiceClient();
  const { error } = await supabase.from("rooms").insert({ number: parsed.data.number, unit_id: parsed.data.unit_id, is_active: true });
  if (error) {
    if (error.code === "23505") return { ok: false, error: `${roomLabel(parsed.data.number)} already exists.` };
    return { ok: false, error: error.message };
  }

  await logAudit("room.created", "room", null, parsed.data);
  refreshRoomPages();
  return { ok: true };
}

// A room with upcoming stays can't be switched off: guests are already pencilled into it.
export async function setRoomActive(roomId: string, isActive: boolean) {
  if (!(await isAdmin())) return UNAUTHORIZED;
  if (!id.safeParse(roomId).success) return { ok: false, error: "Room not found" };

  const supabase = createServiceClient();
  const room = await loadRoom(supabase, roomId);
  if (!room) return { ok: false, error: "Room not found" };

  if (!isActive) {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .gte("check_out", toISODate(new Date()))
      .not("status", "in", "(cancelled,no_show)");
    const upcoming = count ?? 0;
    if (upcoming > 0) {
      return {
        ok: false,
        error: `${roomLabel(room.number)} has ${upcoming} upcoming booking${upcoming === 1 ? "" : "s"}. Move ${upcoming === 1 ? "it" : "them"} to another room first.`,
      };
    }
  }

  const { error } = await supabase.from("rooms").update({ is_active: isActive }).eq("id", roomId);
  if (error) return { ok: false, error: error.message };

  await logAudit(isActive ? "room.activated" : "room.deactivated", "room", roomId, { number: room.number });
  refreshRoomPages();
  return { ok: true };
}

// Only a room that has never been booked can be deleted; otherwise deactivate it.
export async function deleteRoom(roomId: string) {
  if (!(await isAdmin())) return UNAUTHORIZED;
  if (!id.safeParse(roomId).success) return { ok: false, error: "Room not found" };

  const supabase = createServiceClient();
  const room = await loadRoom(supabase, roomId);
  if (!room) return { ok: false, error: "Room not found" };

  const { count } = await supabase.from("bookings").select("id", { count: "exact", head: true }).eq("room_id", roomId);
  if ((count ?? 0) > 0) {
    return { ok: false, error: `${roomLabel(room.number)} has bookings on record, so it can't be deleted. Deactivate it instead.` };
  }

  const { error } = await supabase.from("rooms").delete().eq("id", roomId);
  if (error) return { ok: false, error: error.message };

  await logAudit("room.deleted", "room", roomId, { number: room.number });
  refreshRoomPages();
  return { ok: true };
}

// Door codes live in their own service-role-only table. The code itself is never audited.
export async function setRoomDoorCode(input: { roomId: string; code: string }) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = z.object({ roomId: id, code: z.string().trim().max(40, "Door codes are 40 characters at most") }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid door code" };
  const { roomId, code } = parsed.data;

  const supabase = createServiceClient();
  const room = await loadRoom(supabase, roomId);
  if (!room) return { ok: false, error: "Room not found" };

  const { error } = code
    ? await supabase.from("room_access_codes").upsert({ room_id: roomId, access_code: code, updated_at: new Date().toISOString() })
    : await supabase.from("room_access_codes").delete().eq("room_id", roomId);
  if (error) return { ok: false, error: error.message };

  await logAudit(code ? "room.door_code_set" : "room.door_code_cleared", "room", roomId, { number: room.number });
  revalidatePath("/admin/rooms");
  return { ok: true };
}

// Airbnb links. The import URL and the export token are secrets: never audited, logged or returned.
function refreshAirbnbPages() {
  revalidatePath("/admin/rooms");
  revalidatePath("/admin/bookings/airbnb");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin");
}

export async function setRoomAirbnbUrl(input: { roomId: string; url: string }) {
  if (!(await isAdmin())) return UNAUTHORIZED;
  const parsed = z.object({ roomId: id, url: z.string().trim().max(2000, "That link is too long") }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid link" };
  const { roomId, url } = parsed.data;

  if (url) {
    const problem = airbnbCalendarUrlProblem(url);
    if (problem) return { ok: false, error: problem };
  }

  const supabase = createServiceClient();
  const { data: room } = await supabase.from("rooms").select("id, number, airbnb_sync_error").eq("id", roomId).maybeSingle();
  if (!room) return { ok: false, error: "Room not found" };

  // Clearing the link does not sync: there is nothing to fetch, and syncing would record a bogus error.
  // Reservations already imported stay as they are; they just stop updating.
  if (!url) {
    const { error } = await supabase.from("rooms").update({ airbnb_ical_url: null, airbnb_sync_error: null }).eq("id", roomId);
    if (error) return { ok: false, error: error.message };
    await logAudit("room.airbnb_link_cleared", "room", roomId, { number: room.number });
    refreshAirbnbPages();
    return { ok: true };
  }

  const { error } = await supabase.from("rooms").update({ airbnb_ical_url: url }).eq("id", roomId);
  if (error) return { ok: false, error: error.message };
  await logAudit("room.airbnb_link_set", "room", roomId, { number: room.number });

  const result = await syncRoom(
    supabase,
    { id: room.id, number: room.number, airbnb_ical_url: url, airbnb_sync_error: room.airbnb_sync_error },
    { now: new Date() },
  );
  refreshAirbnbPages();
  if (!result.ok) return { ok: false, error: `Saved, but the first sync failed: ${result.error}` };
  return { ok: true };
}

// Replaces the secret in our calendar link. The old link stops working at once; Airbnb must be given the new one.
export async function newRoomExportLink(roomId: string) {
  if (!(await isAdmin())) return UNAUTHORIZED;
  if (!id.safeParse(roomId).success) return { ok: false, error: "Room not found" };

  const supabase = createServiceClient();
  const room = await loadRoom(supabase, roomId);
  if (!room) return { ok: false, error: "Room not found" };

  const { error } = await supabase.from("rooms").update({ ical_export_token: randomBytes(32).toString("hex") }).eq("id", roomId);
  if (error) return { ok: false, error: error.message };

  await logAudit("room.export_link_replaced", "room", roomId, { number: room.number });
  revalidatePath("/admin/rooms");
  return { ok: true };
}

// One room, or every room that has an Airbnb link.
export async function syncAirbnbNow(roomId?: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const supabase = createServiceClient();
  const now = new Date();

  if (roomId !== undefined) {
    if (!id.safeParse(roomId).success) return { ok: false, error: "Room not found" };
    const { data: room } = await supabase
      .from("rooms")
      .select("id, number, airbnb_ical_url, airbnb_sync_error")
      .eq("id", roomId)
      .maybeSingle();
    if (!room) return { ok: false, error: "Room not found" };
    if (!room.airbnb_ical_url) return { ok: false, error: "This room has no Airbnb link yet." };
    const result = await syncRoom(supabase, room, { now });
    refreshAirbnbPages();
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  const { failed } = await syncRooms(supabase, { now });
  refreshAirbnbPages();
  if (failed > 0) {
    return { ok: false, error: `${failed} room${failed === 1 ? "" : "s"} failed to sync. See the Rooms page for the reason.` };
  }
  return { ok: true };
}

// Staff add a name and notes to an imported booking. Airbnb's calendar never carries them, so a sync leaves them alone.
export async function updateAirbnbBooking(input: { id: string; guest_name: string; notes: string }) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = airbnbBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("external_reservations")
    .update({ guest_name: parsed.data.guest_name || null, notes: parsed.data.notes || null })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };

  await logAudit("airbnb_booking.updated", "external_reservation", parsed.data.id);
  refreshAirbnbPages();
  return { ok: true };
}
