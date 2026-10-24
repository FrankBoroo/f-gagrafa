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
// (see src/lib/payments/booking-payment.ts), so abandoned checkouts don't burn a use.
// Free stays have no payment, so they claim their use up front (claimPromoUse).
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

// Takes one use of a code up front, for free (100% off) stays, which have no payment step to
// count the use later. The update only lands if used_count is still what was read, so two
// guests can't both take a code's last use. Retries a couple of times if another booking won.
export async function claimPromoUse(code: string): Promise<boolean> {
  const supabase = createServiceClient();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: promo } = await supabase
      .from("promo_codes")
      .select("used_count, max_uses")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();
    if (!promo) return false;
    if (promo.max_uses !== null && promo.used_count >= promo.max_uses) return false;

    const { data: claimed, error } = await supabase
      .from("promo_codes")
      .update({ used_count: promo.used_count + 1 })
      .eq("code", code)
      .eq("used_count", promo.used_count)
      .select("code");
    if (error) return false;
    if (claimed && claimed.length > 0) return true;
  }
  return false;
}

// Gives back a use claimed by claimPromoUse when the booking itself couldn't be created.
// Best-effort: a lost release only means one use is counted that didn't happen.
export async function releasePromoUse(code: string): Promise<void> {
  const supabase = createServiceClient();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: promo } = await supabase.from("promo_codes").select("used_count").eq("code", code).maybeSingle();
    if (!promo || promo.used_count <= 0) return;
    const { data: released } = await supabase
      .from("promo_codes")
      .update({ used_count: promo.used_count - 1 })
      .eq("code", code)
      .eq("used_count", promo.used_count)
      .select("code");
    if (released && released.length > 0) return;
  }
}
