import { createServiceClient } from "@/lib/supabase/server";
import { ManualBookingForm } from "@/components/admin/ManualBookingForm";
import { upcomingSpecialsByUnit } from "@/lib/booking/special-prices-db";
import type { Unit } from "@/lib/types";
import { getPublicSettings } from "@/lib/site-settings";

export default async function NewBookingPage() {
  const supabase = createServiceClient();
  const { pricing } = await getPublicSettings();
  const [{ data: units }, { data: rooms }] = await Promise.all([
    supabase.from("units").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("rooms").select("id, number, unit_id").eq("is_active", true).order("number"),
  ]);
  const specials = await upcomingSpecialsByUnit();
  const pricedUnits = ((units as Unit[]) ?? []).map((u: Unit) => ({ ...u, special_prices: specials[u.id] ?? [] }));

  return (
    <div>
      <h1 className="text-3xl">New booking</h1>
      <p className="mt-2 text-sm text-navy/50">
        For phone, walk-in, or cash/bank-transfer reservations. Availability is checked the
        same way as the public booking flow.
      </p>
      <ManualBookingForm units={pricedUnits} rooms={rooms ?? []} pricing={pricing} />
    </div>
  );
}
