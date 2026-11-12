import "server-only";
import type { createServiceClient } from "@/lib/supabase/server";
import { refundPaystackTransaction } from "@/lib/payments/paystack";
import { paystackRefundCapacity, planPaystackRefund, refundReference } from "@/lib/payments/refund-split";
import { formatMoney } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import type { Enums, Json, TablesUpdate } from "@/types/database";

type ServiceClient = ReturnType<typeof createServiceClient>;

export interface RefundRow {
  amount: number;
  paystack_reference: string | null;
}

interface RefundPayment {
  amount: number | string;
  status: string;
  method: string;
  paystack_reference: string | null;
  paid_at?: string | null;
  created_at?: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Sends one refund back through Paystack, split across the booking's Paystack payments
// (newest first, each at most what it can still refund). Shared by "Cancel / refund" and
// "Refund overpayment".
//  - Nothing refundable, or more than Paystack can cover: refused, nothing sent.
//  - Every part went through: returns the refund rows for the caller to record.
//  - A later part failed: the parts that went through are recorded here (rows and
//    `refunded_amount`, audit `booking.refund_partial`) and an error says what's left;
//    `untouched` tells the admin what was not changed (e.g. "The booking wasn't cancelled.").
export async function sendPaystackRefund(args: {
  supabase: ServiceClient;
  booking: { id: string; booking_code: string; currency: Enums<"booking_currency">; refunded_amount: number | null };
  payments: RefundPayment[] | null;
  amount: number;
  note: string;
  untouched: string;
  audit: Record<string, Json | undefined>;
}): Promise<{ ok: true; rows: RefundRow[] } | { ok: false; error: string }> {
  const { supabase, booking, payments, amount, note, untouched, audit } = args;

  const capacity = paystackRefundCapacity(payments);
  if (capacity.length === 0) {
    return { ok: false, error: "There's no Paystack payment on this booking to refund automatically. Record it as a cash, bank or Mobile Money refund instead." };
  }
  const plan = planPaystackRefund(payments, amount);
  if (!plan) {
    const available = capacity.reduce((sum: number, c: { available: number }) => sum + c.available, 0);
    return {
      ok: false,
      error: `Paystack can refund at most ${formatMoney(available, booking.currency)} on this booking. Nothing was changed. Refund that through Paystack and record the rest as a manual refund (cash, bank or Mobile Money).`,
    };
  }

  const rows: RefundRow[] = [];
  let failure: { message: string } | null = null;
  for (const part of plan) {
    try {
      await refundPaystackTransaction({ reference: part.reference, amountInMajorUnits: part.amount, note });
      rows.push({ amount: part.amount, paystack_reference: refundReference(part.reference) });
    } catch (err: any) {
      failure = { message: err?.message ?? "unknown error" };
      break;
    }
  }

  if (!failure) return { ok: true, rows };

  if (rows.length === 0) {
    return {
      ok: false,
      error: `Paystack couldn't process the refund: ${failure.message}. Nothing was changed. You can record a manual refund instead.`,
    };
  }

  // Part of the money went back through Paystack: record exactly that part so the books
  // match, leave the rest of the booking as it was, and say what's left for a person to refund.
  const refundedNow = round2(rows.reduce((sum: number, r: RefundRow) => sum + r.amount, 0));
  const left = round2(amount - refundedNow);
  const partError = await insertRefundRows(supabase, booking, "paystack", rows);
  if (!partError) {
    const partUpdate: TablesUpdate<"bookings"> = { refunded_amount: Number(booking.refunded_amount ?? 0) + refundedNow };
    await supabase.from("bookings").update(partUpdate).eq("id", booking.id);
  }
  await logAudit("booking.refund_partial", "booking", booking.id, {
    ...audit, booking_code: booking.booking_code, refundedNow, left,
  });
  const recorded = partError
    ? ` It couldn't be recorded here (${partError.message}): record ${formatMoney(refundedNow, booking.currency)} as a refund so your books match.`
    : "";
  return {
    ok: false,
    error: `Only part of the refund went through: ${formatMoney(refundedNow, booking.currency)} was refunded through Paystack, then Paystack failed (${failure.message}). ${formatMoney(left, booking.currency)} is left to refund manually.${recorded} ${untouched} Do not refund the Paystack part again.`,
  };
}

// Records refunds as negative `refunded` payment rows. Returns the insert error, if any.
export async function insertRefundRows(
  supabase: ServiceClient,
  booking: { id: string; currency: Enums<"booking_currency"> },
  method: "paystack" | "cash" | "bank" | "momo",
  rows: RefundRow[]
): Promise<{ message: string } | null> {
  const { error } = await supabase.from("payments").insert(
    rows.map((r: RefundRow) => ({
      booking_id: booking.id,
      amount: -r.amount,
      currency: booking.currency,
      method,
      status: "refunded",
      paystack_reference: r.paystack_reference,
      paid_at: new Date().toISOString(),
    }))
  );
  return error ? { message: error.message } : null;
}
