import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isOverLimit, RATE_LIMITED_MESSAGE, RATE_LIMITS } from "@/lib/rate-limit";
import { roomExportIcs } from "@/lib/airbnb/export";
import { addDays, toISODate } from "@/lib/booking/dates";
import { log } from "@/lib/logger";

// Private per-room calendar that Airbnb polls. The token in the URL is the only secret,
// so it is never logged. Not-found answers carry no body.
const TOKEN_RE = /^[0-9a-f]{64}$/;
const notFound = () => new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  if (await isOverLimit("icalExport")) {
    return NextResponse.json(
      { error: RATE_LIMITED_MESSAGE },
      { status: 429, headers: { "Retry-After": String(RATE_LIMITS.icalExport.windowSeconds), "Cache-Control": "no-store" } }
    );
  }

  const { token: raw } = await ctx.params;
  const token = raw.replace(/\.ics$/i, "").toLowerCase();
  if (!TOKEN_RE.test(token)) return notFound();

  const supabase = createServiceClient();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, number, unit_id")
    .eq("ical_export_token", token)
    .maybeSingle();
  if (roomError) {
    log.error("ical.export_room_failed", {}, roomError);
    return new NextResponse(null, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
  if (!room) return notFound();

  const now = new Date();
  const today = toISODate(now);
  const staleHold = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

  const [bookingsRes, blocksRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, check_in, check_out")
      .eq("room_id", room.id)
      .not("status", "in", "(cancelled,no_show)")
      // Same rule as is_room_available(): an unpaid pending hold older than 30 minutes is not a sale.
      .or(`status.neq.pending,payment_status.neq.unpaid,created_at.gte.${staleHold}`)
      .gte("check_out", addDays(today, -30))
      .lte("check_in", addDays(today, 730))
      .order("check_in"),
    supabase
      .from("blocked_dates")
      .select("id, start_date, end_date")
      .or(`room_id.eq.${room.id},and(room_id.is.null,unit_id.eq.${room.unit_id})`)
      .gte("end_date", addDays(today, -30))
      .order("start_date"),
  ]);
  if (bookingsRes.error || blocksRes.error) {
    log.error("ical.export_query_failed", { roomNumber: room.number }, bookingsRes.error ?? blocksRes.error);
    return new NextResponse(null, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  const body = roomExportIcs({
    roomNumber: room.number,
    bookings: bookingsRes.data ?? [],
    blocks: blocksRes.data ?? [],
    now,
  });
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
  });
}
