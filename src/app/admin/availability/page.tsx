import { createServiceClient } from "@/lib/supabase/server";
import { BlockedDatesManager } from "@/components/admin/BlockedDatesManager";

export default async function AdminAvailabilityPage() {
  const supabase = createServiceClient();

  const [{ data: rooms }, { data: units }, { data: blocks }] = await Promise.all([
    supabase.from("rooms").select("id, number, units(name)").order("number"),
    supabase.from("units").select("id, name"),
    supabase.from("blocked_dates").select("*").order("start_date"),
  ]);

  return (
    <div>
      <h1 className="text-3xl">Availability</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy/50">
        Block dates for maintenance, owner stays, or anything else — blocked
        dates are enforced the same way as existing bookings, so guests can&rsquo;t
        book over them.
      </p>
      <div className="mt-8">
        <BlockedDatesManager rooms={rooms ?? []} units={units ?? []} blocks={blocks ?? []} />
      </div>
    </div>
  );
}
