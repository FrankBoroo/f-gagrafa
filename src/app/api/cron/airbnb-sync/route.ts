import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env.server";
import { syncRooms } from "@/lib/airbnb/sync";
import { log } from "@/lib/logger";

// Called every 15 minutes by an external scheduler (see LAUNCH.md); Vercel Hobby only
// allows daily crons, so the daily reminders cron is just the fallback.
// Protected by CRON_SECRET so this can't be triggered by anyone who finds the URL.
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
  try {
    const result = await syncRooms(supabase, { olderThanMinutes: 0, now: new Date() });
    return NextResponse.json(result);
  } catch (err) {
    log.error("airbnb.sync.cron_failed", { errorName: err instanceof Error ? err.name : "unknown" });
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
