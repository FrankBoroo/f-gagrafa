import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { BookingFlow } from "@/components/site/BookingFlow";
import { getPublicSettings } from "@/lib/site-settings";
import { upcomingSpecialsByUnit } from "@/lib/booking/special-prices-db";
import type { Unit } from "@/lib/types";

export const metadata = { title: "Book Your Stay — The Gagrafa" };

export default async function BookingPage() {
  const supabase = await createClient();
  const settings = await getPublicSettings();
  const { data: units } = await supabase
    .from("units")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  // Special prices for the coming dates, so the totals shown match what the server charges.
  const specials = await upcomingSpecialsByUnit();
  const pricedUnits = ((units as Unit[]) ?? []).map((u: Unit) => ({ ...u, special_prices: specials[u.id] ?? [] }));

  return (
    <div className="container-gagrafa max-w-4xl py-24">
      <p className="eyebrow">Reserve</p>
      <h1 className="mt-3 text-4xl">Book Your Stay</h1>
      <Suspense>
        <BookingFlow units={pricedUnits} depositPercent={settings.deposit_percent} pricing={settings.pricing} />
      </Suspense>
    </div>
  );
}
