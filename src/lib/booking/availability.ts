import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Db = SupabaseClient<Database>;

// Cancels unpaid checkouts older than 30 minutes, so an abandoned hold can't block dates.
export async function releaseStaleHolds(supabase: Db): Promise<void> {
  await supabase.rpc("expire_stale_pending_bookings");
}
