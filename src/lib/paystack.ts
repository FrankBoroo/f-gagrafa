import { serverEnv } from "@/lib/env.server";
// Thin wrapper around Paystack's REST API. Server-only — never import from a
// client component (it uses PAYSTACK_SECRET_KEY).

const PAYSTACK_BASE_URL = "https://api.paystack.co";

interface InitializeTransactionArgs {
  email: string;
  amountInMajorUnits: number; // e.g. GHS amount, NOT pesewas
  reference: string;
  currency?: "GHS" | "USD";
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    status: "success" | "failed" | "abandoned";
    reference: string;
    amount: number; // pesewas/kobo
    currency: string;
    paid_at: string | null;
    channel: string;
    metadata: Record<string, unknown>;
  };
}

function requireSecretKey(): string {
  const key = serverEnv.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not set. Add it to .env.local from your Paystack dashboard."
    );
  }
  return key;
}

// Cards, Mobile Money (MTN/Vodafone/AirtelTigo via Paystack), and bank transfer.
// USSD/QR are left out on purpose — add to this list if you need them.
const DEFAULT_CHANNELS = ["card", "mobile_money", "bank_transfer"];

export async function initializePaystackTransaction({
  email,
  amountInMajorUnits,
  reference,
  currency = "GHS",
  callbackUrl,
  metadata,
}: InitializeTransactionArgs): Promise<PaystackInitializeResponse["data"]> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amountInMajorUnits * 100), // Paystack expects the smallest currency unit
      currency,
      reference,
      callback_url: callbackUrl,
      channels: DEFAULT_CHANNELS,
      metadata,
    }),
  });

  const json = (await res.json()) as PaystackInitializeResponse;

  if (!res.ok || !json.status) {
    throw new Error(json.message || "Could not initialize Paystack transaction");
  }

  return json.data;
}

export async function verifyPaystackTransaction(
  reference: string
): Promise<PaystackVerifyResponse["data"]> {
  const res = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${requireSecretKey()}` }, cache: "no-store" }
  );

  const json = (await res.json()) as PaystackVerifyResponse;

  if (!res.ok || !json.status) {
    throw new Error(json.message || "Could not verify Paystack transaction");
  }

  return json.data;
}

interface PaystackRefundResponse {
  status: boolean;
  message: string;
  data?: { id?: number; status?: string; amount?: number; currency?: string };
}

// Refunds (part or all) of a transaction we took through Paystack. Paystack processes
// refunds asynchronously, so a successful call means "accepted", not "money has landed".
export async function refundPaystackTransaction({
  reference, amountInMajorUnits, note,
}: {
  reference: string;
  amountInMajorUnits: number;
  note?: string;
}): Promise<NonNullable<PaystackRefundResponse["data"]>> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/refund`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireSecretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction: reference,
      amount: Math.round(amountInMajorUnits * 100), // smallest currency unit
      customer_note: note || undefined,
      merchant_note: note || undefined,
    }),
  });

  const json = (await res.json()) as PaystackRefundResponse;
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Paystack could not process the refund");
  }
  return json.data ?? {};
}
