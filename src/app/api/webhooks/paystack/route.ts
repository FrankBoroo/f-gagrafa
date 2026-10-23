import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { confirmPaymentByReference } from "@/lib/booking-payment";
import { serverEnv } from "@/lib/env.server";

// Backup confirmation path: the success page verifies payment when the guest
// is redirected back, but that depends on the guest's browser completing the
// redirect. This webhook confirms it server-to-server regardless, and is
// idempotent with the success page via confirmPaymentByReference.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  const secret = serverEnv.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  if (hash !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "charge.success") {
    const reference = event.data?.reference;
    if (reference) {
      await confirmPaymentByReference(reference);
    }
  }

  return NextResponse.json({ received: true });
}
