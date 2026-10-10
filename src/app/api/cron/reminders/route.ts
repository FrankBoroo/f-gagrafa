import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPreArrivalReminder, sendPostStayReviewRequest } from "@/lib/email";

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Scheduled daily (see vercel.json). Protected by CRON_SECRET so this can't
// be triggered by anyone who finds the URL.
//
// Pre-arrival: sends ~24-48h before check-in — i.e. any paid booking whose
// check-in is "tomorrow" relative to when this runs once a day.
// Post-stay: sends the day after check-out, once, ever (tracked by
// review_request_sent_at so re-running the job is always safe).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // --- Pre-arrival reminders ---
  const { data: arriving } = await supabase
    .from("bookings")
    .select("*, units(name)")
    .eq("check_in", dateKey(tomorrow))
    .eq("payment_status", "paid")
    .is("reminder_sent_at", null);

  for (const booking of arriving ?? []) {
    await sendPreArrivalReminder(booking, (booking as any).units?.name ?? "your residence");
    await supabase.from("bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", booking.id);
  }

  // --- Post-stay review requests ---
  const { data: departed } = await supabase
    .from("bookings")
    .select("*")
    .eq("check_out", dateKey(yesterday))
    .eq("payment_status", "paid")
    .is("review_request_sent_at", null);

  for (const booking of departed ?? []) {
    await sendPostStayReviewRequest(booking);
    await supabase.from("bookings").update({ review_request_sent_at: new Date().toISOString() }).eq("id", booking.id);
  }

  return NextResponse.json({
    preArrivalSent: arriving?.length ?? 0,
    postStaySent: departed?.length ?? 0,
  });
}
