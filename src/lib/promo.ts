import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

export interface PromoCheckResult {
  valid: boolean;
  error?: string;
  code?: string;
  discountAmount?: number;
  finalAmount?: number;
}

// Shared by the live preview in the booking flow and the actual booking
// creation, so the discount a guest sees is exactly what gets charged —
// this does not increment used_count; that happens once payment succeeds
// (see src/lib/booking-payment.ts), so abandoned checkouts don't burn a use.
export async function checkPromoCode(rawCode: string, baseAmount: number): Promise<PromoCheckResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { valid: false, error: "Enter a code" };

  const supabase = createServiceClient();
  const { data: promo } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (!promo) return { valid: false, error: "Invalid or inactive code" };

  const today = new Date().toISOString().slice(0, 10);
  if (promo.valid_from && today < promo.valid_from) return { valid: false, error: "This code isn't active yet" };
  if (promo.valid_until && today > promo.valid_until) return { valid: false, error: "This code has expired" };
  if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
    return { valid: false, error: "This code has reached its usage limit" };
  }

  const discountAmount = promo.discount_type === "percent"
    ? Math.round(baseAmount * (Number(promo.discount_value) / 100))
    : Math.min(Number(promo.discount_value), baseAmount);

  return {
    valid: true,
    code: promo.code,
    discountAmount,
    finalAmount: Math.max(baseAmount - discountAmount, 0),
  };
}
