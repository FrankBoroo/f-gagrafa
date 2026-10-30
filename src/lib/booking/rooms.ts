import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Db = SupabaseClient<Database>;

interface DbError {
  code?: string;
  message?: string;
}

export interface FreeRoom {
  id: string;
  number: number;
}

// Active rooms of a type that are free for the whole stay, lowest number first. null means
// the lookup itself failed, and the caller decides what that means (the
// bookings_no_room_overlap constraint is the final guard).
export async function freeRoomsForType(
  supabase: Db,
  stay: { unitId: string; checkIn: string; checkOut: string; excludeBookingId?: string }
): Promise<FreeRoom[] | null> {
  const { data, error } = await supabase.rpc("free_rooms_for_type", {
    p_unit_id: stay.unitId,
    p_check_in: stay.checkIn,
    p_check_out: stay.checkOut,
    p_exclude_booking_id: stay.excludeBookingId,
  });
  return error ? null : data ?? [];
}

// Two guests can pick the same free room at once. The loser's insert fails with 23P01, so
// it moves on to the next room; only when every room is gone does the caller see 23P01.
export async function tryRoomsInOrder<T>(
  roomIds: string[],
  attempt: (roomId: string) => PromiseLike<{ data: T | null; error: DbError | null }>
): Promise<{ data: T | null; error: DbError | null; roomId: string | null }> {
  for (const roomId of roomIds) {
    const { data, error } = await attempt(roomId);
    if (error?.code !== "23P01") return { data, error, roomId };
  }
  return { data: null, error: { code: "23P01" }, roomId: null };
}

// New dates for a booking: stay in the same room when it's free, otherwise the lowest free one.
export function chooseRoomForNewDates(
  freeRooms: FreeRoom[],
  currentRoomId: string | null
): { roomId: string; moved: boolean } | null {
  if (freeRooms.some((room) => room.id === currentRoomId)) {
    return { roomId: currentRoomId as string, moved: false };
  }
  return freeRooms.length ? { roomId: freeRooms[0].id, moved: true } : null;
}
