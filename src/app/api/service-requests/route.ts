import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendServiceRequestNotification } from "@/lib/notify/email";
import { hasPortalAccess } from "@/lib/portal-session";
import { isOverLimit, RATE_LIMITED_MESSAGE, RATE_LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { oneOf } from "@/lib/db-values";
import { Constants } from "@/types/database";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  if (await isOverLimit("serviceRequest")) {
    return NextResponse.json(
      { error: RATE_LIMITED_MESSAGE },
      { status: 429, headers: { "Retry-After": String(RATE_LIMITS.serviceRequest.windowSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const { booking_id, type: rawType, description } = (body ?? {}) as Record<string, unknown>;
  const type = typeof rawType === "string" ? oneOf(Constants.public.Enums.service_request_type, rawType) : undefined;
  if (typeof booking_id !== "string" || !UUID_RE.test(booking_id) || !type) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }
  if (description != null && (typeof description !== "string" || description.length > 1000)) {
    return NextResponse.json({ error: "Description is too long" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Only the verified guest of this booking may raise requests against it.
  const { data: owner } = await supabase
    .from("bookings")
    .select("booking_code, status")
    .eq("id", booking_id)
    .maybeSingle();
  if (!owner) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!(await hasPortalAccess(owner.booking_code))) {
    return NextResponse.json({ error: "Please verify your booking first." }, { status: 403 });
  }
  if (owner.status === "cancelled" || owner.status === "no_show") {
    return NextResponse.json({ error: "This booking is no longer active." }, { status: 400 });
  }

  const { data: serviceRequest, error } = await supabase
    .from("service_requests")
    .insert({ booking_id, type, description })
    .select()
    .single();

  if (error) {
    log.error("service_request.insert_failed", { booking_id, type }, error);
    return NextResponse.json({ error: "We couldn't send your request. Please try again." }, { status: 500 });
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("booking_code, guest_name")
    .eq("id", booking_id)
    .single();

  await sendServiceRequestNotification(serviceRequest, booking);

  return NextResponse.json({ ok: true });
}
