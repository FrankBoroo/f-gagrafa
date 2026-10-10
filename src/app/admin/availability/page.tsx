import { createServiceClient } from "@/lib/supabase/server";
import { BlockedDatesManager } from "@/components/admin/BlockedDatesManager";
import type { Unit } from "@/lib/types";

export default async function AdminAvailabilityPage() {
  const supabase = createServiceClient();

  const [{ data: units }, { data: blocks }] = await Promise.all([
    supabase.from("units").select("*").order("sort_order"),
    supabase.from("blocked_dates").select("*").order("start_date"),
  ]);

  return (
    <div>
      <h1 className="text-3xl">Availability</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy/50">
        Block dates for maintenance, owner stays, or anything else — blocked
        dates are enforced the same way as existing bookings, so guests can't
        book over them.
      </p>
      <div className="mt-8">
        <BlockedDatesManager units={(units as Unit[]) ?? []} blocks={blocks ?? []} />
      </div>
    </div>
  );
}
