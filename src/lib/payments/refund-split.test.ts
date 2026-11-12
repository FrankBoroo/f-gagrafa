import { describe, expect, it } from "vitest";
import { paystackRefundCapacity, planPaystackRefund, refundReference } from "@/lib/payments/refund-split";

const CODE = "GAG-2026-ABCDEF";
const BAL = `${CODE}-BZZ99ZZ`;

const pay = (paystack_reference: string, amount: number, paid_at: string, extra: Record<string, unknown> = {}) => ({
  amount,
  status: "success",
  method: "paystack",
  paystack_reference,
  paid_at,
  created_at: paid_at,
  ...extra,
});
const refund = (paystack_reference: string | null, amount: number, method = "paystack") => ({
  amount: -amount,
  status: "refunded",
  method,
  paystack_reference,
  paid_at: "2026-11-20T00:00:00Z",
  created_at: "2026-11-20T00:00:00Z",
});

describe("refundReference", () => {
  it("names the original Paystack payment", () => {
    expect(refundReference(BAL, 1700000000000)).toBe(`refund:${BAL}:1700000000000`);
  });
});

describe("paystackRefundCapacity", () => {
  it("lists successful Paystack payments newest first, less refunds made against each", () => {
    const payments = [
      pay(CODE, 500, "2026-11-01T10:00:00Z"),
      pay(BAL, 500, "2026-11-10T10:00:00Z"),
      refund(`refund:${BAL}:1`, 200),
      pay("cash-row", 300, "2026-11-11T10:00:00Z", { method: "cash", paystack_reference: null }),
      pay(`${CODE}-BPEND00`, 400, "2026-11-12T10:00:00Z", { status: "pending" }),
    ];
    expect(paystackRefundCapacity(payments)).toEqual([
      { reference: BAL, available: 300 },
      { reference: CODE, available: 500 },
    ]);
  });

  it("counts an older refund:<booking code>:<ts> row against the first Paystack payment", () => {
    const payments = [pay(`${CODE}-BFIRST1`, 500, "2026-11-01T10:00:00Z"), pay(BAL, 500, "2026-11-10T10:00:00Z"), refund(`refund:${CODE}:1`, 450)];
    expect(paystackRefundCapacity(payments)).toEqual([
      { reference: BAL, available: 500 },
      { reference: `${CODE}-BFIRST1`, available: 50 },
    ]);
  });

  it("ignores manual refunds (they didn't go through Paystack)", () => {
    const payments = [pay(CODE, 500, "2026-11-01T10:00:00Z"), refund(null, 200, "cash")];
    expect(paystackRefundCapacity(payments)).toEqual([{ reference: CODE, available: 500 }]);
  });
});

describe("planPaystackRefund", () => {
  const payments = [pay(CODE, 500, "2026-11-01T10:00:00Z"), pay(BAL, 500, "2026-11-10T10:00:00Z")];

  it("takes from the newest payment first", () => {
    expect(planPaystackRefund(payments, 300)).toEqual([{ reference: BAL, amount: 300 }]);
    expect(planPaystackRefund(payments, 1000)).toEqual([
      { reference: BAL, amount: 500 },
      { reference: CODE, amount: 500 },
    ]);
    expect(planPaystackRefund(payments, 700.5)).toEqual([
      { reference: BAL, amount: 500 },
      { reference: CODE, amount: 200.5 },
    ]);
  });

  it("is null when Paystack can't cover the whole amount", () => {
    expect(planPaystackRefund(payments, 1000.5)).toBeNull();
    expect(planPaystackRefund([], 10)).toBeNull();
  });
});
