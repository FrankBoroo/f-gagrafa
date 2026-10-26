import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env.server";

// Remembers which booking this browser just sent to Paystack, so that when the guest
// closes the checkout we can release their own unpaid hold straight away. Only the
// browser that made the booking holds the signed cookie, so knowing a booking code is
// not enough to release someone else's dates.

const COOKIE_NAME = "gagrafa_checkout";
const COOKIE_MINUTES = 60; // the hold itself lapses after 30 minutes

function signingKey(): string {
  const base = serverEnv.PORTAL_SESSION_SECRET || serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("Set PORTAL_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY) to sign checkout sessions.");
  return crypto.createHmac("sha256", base).update("gagrafa-checkout-session-v1").digest("hex");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

export function createCheckoutToken(code: string, minutes = COOKIE_MINUTES): string {
  const payload = Buffer.from(
    JSON.stringify({ c: code.toUpperCase(), e: Date.now() + minutes * 60_000 })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyCheckoutToken(token: string | null | undefined, code: string): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const given = Buffer.from(signature);
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.c === code.toUpperCase() && typeof data.e === "number" && data.e > Date.now();
  } catch {
    return false;
  }
}

// Only callable from a Server Action or Route Handler. Never throws: without the cookie
// the guest simply waits out the 30-minute hold, as before.
export async function rememberCheckout(code: string): Promise<void> {
  try {
    const store = await cookies();
    store.set(COOKIE_NAME, createCheckoutToken(code), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // sent on the top-level redirect back from Paystack
      path: "/booking",
      maxAge: COOKIE_MINUTES * 60,
    });
  } catch {
    // Signing key missing: fall back to the normal hold expiry.
  }
}

export async function isOwnCheckout(code: string): Promise<boolean> {
  try {
    const store = await cookies();
    return verifyCheckoutToken(store.get(COOKIE_NAME)?.value, code);
  } catch {
    return false;
  }
}
