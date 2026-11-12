import { createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth";
import { getPublicSettings } from "@/lib/site-settings";
import { SpecialPricesManager, type SpecialPriceRow } from "@/components/admin/SpecialPricesManager";

export default async function AdminSpecialPricesPage() {
  const supabase = createServiceClient();
  const [{ data: specials, error }, { data: units }, admin, { pricing }] = await Promise.all([
    supabase
      .from("special_prices")
      .select("id, unit_id, start_date, end_date, nightly_price, min_nights, label")
      .order("start_date"),
    supabase.from("units").select("id, name, base_price_per_night").order("sort_order"),
    isAdmin(),
    getPublicSettings(),
  ]);

  const rows: SpecialPriceRow[] = (specials ?? []).map((s: SpecialPriceRow) => ({
    ...s,
    nightly_price: s.nightly_price === null ? null : Number(s.nightly_price),
  }));

  return (
    <div>
      <h1 className="text-3xl">Special prices</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy/50">
        A different nightly price, a minimum stay, or both, for chosen dates on one apartment type: holidays,
        festive weeks, quiet months. Stays of 30 nights or more keep the monthly rate.
        {!admin && " Only admins can add or delete them."}
      </p>
      {error && (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          The special prices could not be loaded. Refresh the page to try again.
        </p>
      )}
      <div className="mt-8">
        <SpecialPricesManager
          isAdmin={admin}
          currency={pricing.currency}
          units={(units ?? []).map((u: { id: string; name: string; base_price_per_night: number }) => ({
            id: u.id,
            name: u.name,
            base_price_per_night: Number(u.base_price_per_night),
          }))}
          specials={rows}
        />
      </div>
    </div>
  );
}
