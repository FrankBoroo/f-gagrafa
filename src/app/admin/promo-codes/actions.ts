"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { promoCodeSchema, type PromoCodeInput } from "@/lib/validations";
import { isAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function createPromoCode(input: PromoCodeInput) {
  if (!(await isAdmin())) return { ok: false, error: "Only admins can manage promo codes" };

  const parsed = promoCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid promo code" };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.from("promo_codes").insert(parsed.data).select().single();
  if (error) {
    return { ok: false, error: error.code === "23505" ? "That code already exists" : error.message };
  }

  await logAudit("promo_code.created", "promo_code", data.id, parsed.data);
  revalidatePath("/admin/promo-codes");
  return { ok: true };
}

export async function togglePromoCodeActive(id: string, isActive: boolean) {
  if (!(await isAdmin())) return { ok: false, error: "Only admins can manage promo codes" };

  const supabase = createServiceClient();
  const { error } = await supabase.from("promo_codes").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit("promo_code.active_toggled", "promo_code", id, { is_active: isActive });
  revalidatePath("/admin/promo-codes");
  return { ok: true };
}
