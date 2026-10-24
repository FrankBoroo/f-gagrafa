import "server-only";
import crypto from "crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env.server";

// Per-visitor limits for public actions, counted in Postgres (`rate_limit_hit`,
// supabase/migration-rate-limits.sql) so they hold across Vercel's many instances.
// These sit on top of the per-email and per-booking-code checks, which a visitor can
// dodge by changing the email or code they type.
export const RATE_LIMITS = {
  booking: { max: 10, windowSeconds: 60 * 60 },
  availability: { max: 60, windowSeconds: 10 * 60 },
  promo: { max: 20, windowSeconds: 10 * 60 },
  contact: { max: 5, windowSeconds: 10 * 60 },
  portal: { max: 20, windowSeconds: 15 * 60 },
  serviceRequest: { max: 10, windowSeconds: 60 * 60 },
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

export const RATE_LIMITED_MESSAGE = "Too many requests. Please wait a few minutes and try again.";

// Vercel sets x-forwarded-for itself (client IP first) and overwrites whatever the
// client sent, so the first entry can be trusted there.
export function clientIpFrom(h: Pick<Headers, "get">): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}

// Raw IPs are personal data; store a keyed hash that can't be reversed or matched elsewhere.
export function hashVisitor(ip: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`rate-limit:${ip}`).digest("hex").slice(0, 32);
}

// True when this visitor has used up the bucket. Fails open: if the database call
// errors (migration not run, outage) the request goes through, because locking real
// guests out of booking is worse than a missed limit.
export async function isOverLimit(bucket: RateLimitBucket): Promise<boolean> {
  const secret = serverEnv.PORTAL_SESSION_SECRET || serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return false;
  const key = hashVisitor(clientIpFrom(await headers()), secret);
  const { max, windowSeconds } = RATE_LIMITS[bucket];

  try {
    const { data, error } = await createServiceClient().rpc("rate_limit_hit", {
      p_bucket: bucket,
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("rate limit check failed", { bucket, code: error.code });
      return false;
    }
    return data === false;
  } catch {
    console.error("rate limit check failed", { bucket });
    return false;
  }
}
