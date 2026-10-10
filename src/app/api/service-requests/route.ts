import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendServiceRequestNotification } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { booking_id, type, description } = await req.json();
  if (!booking_id || !type) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = createServiceClient();

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
