import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendServiceRequestNotification } from "@/lib/email";
import { hasPortalAccess } from "@/lib/portal-session";

const TYPES = ["cleaning", "towels", "maintenance", "other"];

export async function POST(req: NextRequest) {
  const { booking_id, type, description } = await req.json();
  if (!booking_id || !type || !TYPES.includes(type)) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }
  if (typeof description === "string" && description.length > 1000) {
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: booking } = await supabase
    .from("bookings")
    .select("booking_code, guest_name")
    .eq("id", booking_id)
    .single();

  await sendServiceRequestNotification(serviceRequest, booking);

  return NextResponse.json({ ok: true });
}
