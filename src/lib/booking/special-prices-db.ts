import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createServiceClient } from "@/lib/supabase/server";
import { toISODate } from "@/lib/booking/dates";
import { log } from "@/lib/logger";
import type { SpecialPrice } from "@/lib/booking/special-prices";

type Db = SupabaseClient<Database>;

const COLUMNS = "unit_id, start_date, end_date, nightly_price, min_nights";

type Row = SpecialPrice & { unit_id: string };

function toSpecial(row: Row): SpecialPrice {
  return {
    start_date: row.start_date,
    end_date: row.end_date,
    nightly_price: row.nightly_price === null ? null : Number(row.nightly_price),
    min_nights: row.min_nights,
  };
}

function byUnit(rows: Row[]): Record<string, SpecialPrice[]> {
  const grouped: Record<string, SpecialPrice[]> = {};
  for (const row of rows) (grouped[row.unit_id] ??= []).push(toSpecial(row));
  return grouped;
}

// One type's special prices that touch a stay. null means the lookup failed: the caller
// must not price the stay, or the guest could be charged the wrong amount.
export async function specialsForStay(
  supabase: Db,
  stay: { unitId: string; checkIn: string; checkOut: string }
): Promise<SpecialPrice[] | null> {
  const { data, error } = await supabase
    .from("special_prices")
    .select(COLUMNS)
    .eq("unit_id", stay.unitId)
    .gt("end_date", stay.checkIn)
    .lt("start_date", stay.checkOut);
  if (error) {
    log.error("special_prices.lookup_failed", { unit_id: stay.unitId }, error);
    return null;
  }
  return (data ?? []).map(toSpecial);
}

// Every type's special prices that touch a stay, keyed by type id. null when the lookup failed.
export async function specialsByUnitForStay(
  supabase: Db,
  checkIn: string,
  checkOut: string
): Promise<Record<string, SpecialPrice[]> | null> {
  const { data, error } = await supabase.from("special_prices").select(COLUMNS).gt("end_date", checkIn).lt("start_date", checkOut);
  if (error) {
    log.error("special_prices.lookup_failed", {}, error);
    return null;
  }
  return byUnit(data ?? []);
}

// Current and future special prices for the public pages, keyed by type id, so the price a
// guest sees matches what the server will charge. Read with the service role (the table has
// no public policy); only dates, price and minimum nights leave the server.
export async function upcomingSpecialsByUnit(): Promise<Record<string, SpecialPrice[]>> {
  const { data, error } = await createServiceClient()
    .from("special_prices")
    .select(COLUMNS)
    .gte("end_date", toISODate(new Date()))
    .order("start_date");
  if (error) {
    log.error("special_prices.lookup_failed", {}, error);
    return {};
  }
  return byUnit(data ?? []);
}
