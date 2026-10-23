import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPreArrivalReminder, sendPostStayReviewRequest } from "@/lib/email";
import { serverEnv } from "@/lib/env.server";

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
  // Fail closed: without a secret this endpoint would be open to anyone.
  const secret = serverEnv.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Sweep unpaid checkouts that were abandoned. Booking attempts also release these
  // on demand; this just keeps the table tidy.
  const { data: expiredCount } = await supabase.rpc("expire_stale_pending_bookings");
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // --- Pre-arrival reminders ---
  const { data: arriving } = await supabase
    .from("bookings")
    .select("*, units(name), payments(amount, status)")
    .eq("check_in", dateKey(tomorrow))
    .in("payment_status", ["paid", "partial"])
    .neq("status", "cancelled")
    .is("reminder_sent_at", null);

  for (const booking of arriving ?? []) {
    const paidSoFar = ((booking as any).payments ?? [])
      .filter((p: any) => p.status === "success" || p.status === "refunded")
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const balanceDue = Math.max(Number(booking.total_amount) - paidSoFar, 0);
    await sendPreArrivalReminder(booking, (booking as any).units?.name ?? "your residence", balanceDue);
    await supabase.from("bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", booking.id);
  }

  // --- Post-stay review requests ---
  const { data: departed } = await supabase
    .from("bookings")
    .select("*")
    .eq("check_out", dateKey(yesterday))
    .in("payment_status", ["paid", "partial"])
    .neq("status", "cancelled")
    .is("review_request_sent_at", null);

  for (const booking of departed ?? []) {
    await sendPostStayReviewRequest(booking);
    await supabase.from("bookings").update({ review_request_sent_at: new Date().toISOString() }).eq("id", booking.id);
  }

  return NextResponse.json({
    preArrivalSent: arriving?.length ?? 0,
    postStaySent: departed?.length ?? 0,
    expiredPending: expiredCount ?? 0,
  });
}
