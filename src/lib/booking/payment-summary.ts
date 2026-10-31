// What a guest pays now and later, shared by the apartment page panel and checkout. Pure, so what
// the guest sees uses the same conversion and rounding as the server, which is the one that decides.
import { canOfferDeposit, depositAmount } from "@/lib/booking/deposit";
import { toChargeAmount, type Pricing } from "@/lib/booking/pricing";

export type PaymentOption = "full" | "deposit";

export function paymentSummary({
  total, depositPercent, pricing, option,
}: {
  total: number;
  depositPercent: number;
  pricing: Pricing;
  option: PaymentOption;
}) {
  const deposit = depositAmount(total, depositPercent);
  const depositOffered = canOfferDeposit(depositPercent) && deposit > 0 && deposit < total;
  const payingDeposit = depositOffered && option === "deposit";
  const dueNow = payingDeposit ? deposit : total;

  // Paystack charges cedis. With USD prices, this is what will actually be charged.
  const chargeTotal = toChargeAmount(total, pricing);
  const chargeDueNow = chargeTotal === null ? null : payingDeposit ? depositAmount(chargeTotal, depositPercent) : chargeTotal;

  return {
    depositOffered,
    payingDeposit,
    deposit,
    dueNow,
    balanceLater: Math.round((total - dueNow) * 100) / 100,
    chargeTotal,
    chargeDueNow,
    convertsToCedis: pricing.currency === "USD" && chargeDueNow !== null,
  };
}
