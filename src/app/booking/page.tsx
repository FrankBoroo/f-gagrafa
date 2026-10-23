import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { BookingFlow } from "@/components/site/BookingFlow";
import { getPublicSettings } from "@/lib/site-settings";
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

  return (
    <div className="container-gagrafa max-w-4xl py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">Reserve</p>
      <h1 className="mt-3 text-4xl">Book Your Stay</h1>
      <Suspense>
        <BookingFlow units={(units as Unit[]) ?? []} depositPercent={settings.deposit_percent} pricing={settings.pricing} />
      </Suspense>
    </div>
  );
}
