import { createServiceClient } from "@/lib/supabase/server";
import { ManualBookingForm } from "@/components/admin/ManualBookingForm";
import type { Unit } from "@/lib/types";
import { getPublicSettings } from "@/lib/site-settings";

export default async function NewBookingPage() {
  const supabase = createServiceClient();
  const { pricing } = await getPublicSettings();
  const { data: units } = await supabase.from("units").select("*").eq("is_active", true).order("sort_order");

  return (
    <div>
      <h1 className="text-3xl">New booking</h1>
      <p className="mt-2 text-sm text-navy/50">
        For phone, walk-in, or cash/bank-transfer reservations. Availability is checked the
        same way as the public booking flow.
      </p>
      <ManualBookingForm units={(units as Unit[]) ?? []} pricing={pricing} />
    </div>
  );
}
