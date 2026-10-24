import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { confirmPaymentByReference } from "@/lib/booking-payment";
import { serverEnv } from "@/lib/env.server";
import { log } from "@/lib/logger";

// Constant-time comparison, so response timing can't reveal how much of a forged signature matched.
function signatureMatches(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = Buffer.from(crypto.createHmac("sha512", secret).update(rawBody).digest("hex"));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// Backup confirmation path: the success page verifies payment when the guest
// is redirected back, but that depends on the guest's browser completing the
// redirect. This webhook confirms it server-to-server regardless, and is
// idempotent with the success page via confirmPaymentByReference.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  const secret = serverEnv.PAYSTACK_SECRET_KEY;
  if (!secret) {
    log.error("paystack_webhook.not_configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  if (!signatureMatches(rawBody, signature, secret)) {
    log.warn("paystack_webhook.bad_signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    log.warn("paystack_webhook.bad_json");
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.event === "charge.success") {
    const reference = event.data?.reference;
    if (reference) {
      try {
        const result = await confirmPaymentByReference(reference);
        log.info("paystack_webhook.processed", { booking_code: reference, outcome: result.outcome });
      } catch (err) {
        // A non-2xx makes Paystack retry later, which is what we want for a transient failure.
        log.error("paystack_webhook.confirm_failed", { booking_code: reference }, err);
        return NextResponse.json({ error: "Could not process" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
