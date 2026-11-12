// Splitting one Paystack refund across a booking's Paystack payments (a deposit at booking
// plus a balance paid later from the portal are two transactions, and Paystack refunds
// each one separately, at most its own amount). Pure, so it can be tested without a database.

interface PaymentLike {
  amount: number | string;
  status: string;
  method: string;
  paystack_reference: string | null;
  paid_at?: string | null;
  created_at?: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// The reference stored on a refund row: the original payment's reference and a timestamp,
// so later refunds know how much of each payment is already returned.
export function refundReference(originalReference: string, now: number = Date.now()): string {
  return `refund:${originalReference}:${now}`;
}

// What each successful Paystack payment can still refund, newest first. Refund rows name
// their original payment ("refund:<reference>:<ts>"); older rows written as
// "refund:<booking code>:<ts>" (or naming no known payment) count against the first one.
export function paystackRefundCapacity(
  payments: PaymentLike[] | null | undefined
): { reference: string; available: number }[] {
  const rows = payments ?? [];
  const when = (p: PaymentLike) => p.paid_at ?? p.created_at ?? "";
  const originals = rows
    .filter((p: PaymentLike) => p.method === "paystack" && p.status === "success" && p.paystack_reference)
    .sort((a: PaymentLike, b: PaymentLike) => (when(a) < when(b) ? 1 : when(a) > when(b) ? -1 : 0));
  if (originals.length === 0) return [];

  const first = originals[originals.length - 1].paystack_reference as string;
  const refunded = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== "refunded" || r.method !== "paystack" || !r.paystack_reference?.startsWith("refund:")) continue;
    const named = r.paystack_reference.slice("refund:".length).replace(/:\d+$/, "");
    const target = originals.some((p: PaymentLike) => p.paystack_reference === named) ? named : first;
    refunded.set(target, (refunded.get(target) ?? 0) + Math.abs(Number(r.amount)));
  }

  return originals.map((p: PaymentLike) => {
    const reference = p.paystack_reference as string;
    return { reference, available: Math.max(round2(Number(p.amount) - (refunded.get(reference) ?? 0)), 0) };
  });
}

// The Paystack refund calls for `amount`, newest payment first, or null when the
// payments can't cover all of it (then nothing should be sent to Paystack).
export function planPaystackRefund(
  payments: PaymentLike[] | null | undefined,
  amount: number
): { reference: string; amount: number }[] | null {
  let left = round2(amount);
  const plan: { reference: string; amount: number }[] = [];
  for (const { reference, available } of paystackRefundCapacity(payments)) {
    if (left <= 0.005) break;
    const take = round2(Math.min(left, available));
    if (take <= 0.005) continue;
    plan.push({ reference, amount: take });
    left = round2(left - take);
  }
  return left <= 0.005 ? plan : null;
}
