"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { isAdmin, UNAUTHORIZED } from "@/lib/auth";
import { toISODate } from "@/lib/booking/dates";

// A real calendar date as YYYY-MM-DD ("2026-02-30" is refused).
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose valid dates")
  .refine((value: string) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && toISODate(parsed) === value;
  }, "Choose valid dates");

const specialPriceSchema = z
  .object({
    unit_id: z.string().uuid("Choose an apartment type"),
    start_date: date,
    end_date: date,
    nightly_price: z.number().positive("The price must be more than 0").max(99999999, "That price is too high").nullable(),
    min_nights: z.number().int("Minimum nights is a whole number").min(1, "Minimum nights is at least 1").max(365, "Minimum nights is at most 365").nullable(),
    label: z.string().trim().max(80, "The label can be up to 80 characters").nullable(),
  })
  .refine((v: { start_date: string; end_date: string }) => v.end_date > v.start_date, {
    message: "The last night must be on or after the first night",
  })
  .refine((v: { nightly_price: number | null; min_nights: number | null }) => v.nightly_price !== null || v.min_nights !== null, {
    message: "Set a price, minimum nights, or both",
  });

const id = z.string().uuid();

function refreshPrices() {
  revalidatePath("/admin/special-prices");
  revalidatePath("/units");
  revalidatePath("/units/[slug]", "layout");
  revalidatePath("/booking");
}

// A special nightly price and/or minimum stay for a date range on one apartment type.
// end_date is exclusive (the morning after the last special night).
export async function createSpecialPrice(input: {
  unit_id: string;
  start_date: string;
  end_date: string;
  nightly_price: number | null;
  min_nights: number | null;
  label: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return UNAUTHORIZED;
  const parsed = specialPriceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the special price details" };
  const data = { ...parsed.data, label: parsed.data.label || null };

  const supabase = createServiceClient();
  const { data: row, error } = await supabase.from("special_prices").insert(data).select("id").single();
  if (error || !row) {
    if (error?.code === "23P01") return { ok: false, error: "This type already has a special price on some of these dates." };
    if (error?.code === "23503") return { ok: false, error: "That apartment type no longer exists." };
    return { ok: false, error: "Could not save the special price. Please try again." };
  }

  await logAudit("special_price.created", "special_price", row.id, {
    unit_id: data.unit_id,
    start_date: data.start_date,
    end_date: data.end_date,
    nightly_price: data.nightly_price,
    min_nights: data.min_nights,
  });
  refreshPrices();
  return { ok: true };
}

export async function deleteSpecialPrice(specialPriceId: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return UNAUTHORIZED;
  if (!id.safeParse(specialPriceId).success) return { ok: false, error: "Special price not found" };

  const supabase = createServiceClient();
  const { error } = await supabase.from("special_prices").delete().eq("id", specialPriceId);
  if (error) return { ok: false, error: "Could not delete the special price. Please try again." };

  await logAudit("special_price.deleted", "special_price", specialPriceId);
  refreshPrices();
  return { ok: true };
}
