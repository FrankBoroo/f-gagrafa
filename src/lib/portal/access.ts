// When a guest may see the door code, Wi-Fi and entry details. Pure, safe in client code.
import { addDays } from "@/lib/booking/dates";
import { roomLabel } from "@/lib/booking/room-assignment";

export type AccessState = "show" | "pending" | "no_room" | "too_early" | "over";

const CLOSED = new Set(["cancelled", "no_show", "checked_out"]);

export function accessState(
  b: { status: string; check_in: string; check_out: string; room_id: string | null; room_confirmed: boolean },
  today: string
): AccessState {
  if (CLOSED.has(b.status) || today > b.check_out) return "over";
  if (b.status === "pending") return "pending";
  if (b.status !== "checked_in" && today < addDays(b.check_in, -1)) return "too_early";
  if (!b.room_id || !b.room_confirmed) return "no_room";
  return "show";
}

export const ACCESS_MESSAGES: Record<Exclude<AccessState, "show">, string> = {
  pending: "Your door code, Wi-Fi and entry details appear here once your booking is confirmed.",
  too_early: "Your door code, Wi-Fi and entry details will appear here from the day before check-in.",
  no_room: "Reception will assign your room before you arrive. Your door code appears here once it's set.",
  over: "Access details are only shown during your stay.",
};

export function roomText(b: { room_confirmed: boolean; room_number: number | null }): string {
  return b.room_confirmed && b.room_number !== null
    ? roomLabel(b.room_number)
    : "Reception will assign it before you arrive";
}
