import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Uptime check: 200 when the app can reach the database, 503 when it can't. Deliberately
// says nothing more, since anyone can call it.
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("property_settings").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
