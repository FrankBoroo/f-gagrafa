import { describe, expect, it } from "vitest";
import { paymentSummary } from "@/lib/booking/payment-summary";
import { GHS_PRICING, type Pricing } from "@/lib/booking/pricing";

const usd: Pricing = { currency: "USD", usdToGhsRate: 12 };

describe("paymentSummary", () => {
  it("splits a USD stay into a down payment and a balance, in dollars and cedis", () => {
    expect(paymentSummary({ total: 900, depositPercent: 50, pricing: usd, option: "deposit" })).toEqual({
      depositOffered: true,
      payingDeposit: true,
      deposit: 450,
      dueNow: 450,
      balanceLater: 450,
      chargeTotal: 10800,
      chargeDueNow: 5400,
      convertsToCedis: true,
    });
  });

  it("charges everything when paying in full", () => {
    const s = paymentSummary({ total: 900, depositPercent: 50, pricing: usd, option: "full" });
    expect(s).toMatchObject({ depositOffered: true, payingDeposit: false, dueNow: 900, balanceLater: 0, chargeDueNow: 10800 });
  });

  it("offers no down payment when Settings turn it off, whatever was asked for", () => {
    const s = paymentSummary({ total: 900, depositPercent: 0, pricing: usd, option: "deposit" });
    expect(s).toMatchObject({ depositOffered: false, payingDeposit: false, dueNow: 900, balanceLater: 0 });
  });

  it("offers no down payment on a free stay", () => {
    expect(paymentSummary({ total: 0, depositPercent: 50, pricing: usd, option: "deposit" }).depositOffered).toBe(false);
  });

  it("has nothing to charge while the exchange rate is missing", () => {
    const s = paymentSummary({ total: 900, depositPercent: 50, pricing: { currency: "USD", usdToGhsRate: null }, option: "deposit" });
    expect(s).toMatchObject({ chargeTotal: null, chargeDueNow: null, convertsToCedis: false });
  });

  it("doesn't convert GHS prices", () => {
    expect(paymentSummary({ total: 900, depositPercent: 50, pricing: GHS_PRICING, option: "deposit" }).convertsToCedis).toBe(false);
  });

  it("works on a monthly-rate total", () => {
    expect(paymentSummary({ total: 3000, depositPercent: 50, pricing: usd, option: "deposit" }).deposit).toBe(1500);
  });
});
