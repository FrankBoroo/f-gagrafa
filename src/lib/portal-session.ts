import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { siteUrl } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

// Guest portal access without guest accounts: after a guest proves who they are
// (booking code + the email/phone on the booking, or a link we emailed them), we
// give their browser a signed, HttpOnly cookie for THAT booking only. Nothing is
// stored in the database; the signature is what makes the cookie trustworthy.

const COOKIE_PREFIX = "gagrafa_portal_";
const COOKIE_DAYS = 14;
const LINK_DAYS = 60;

export const PORTAL_COOKIE_MAX_AGE = COOKIE_DAYS * 86_400;

function signingKey(): string {
  const base = serverEnv.PORTAL_SESSION_SECRET || serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) {
    throw new Error("Set PORTAL_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY) to sign guest portal sessions.");
  }
  return crypto.createHmac("sha256", base).update("gagrafa-portal-session-v1").digest("hex");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

export function createPortalToken(code: string, days = COOKIE_DAYS): string {
  const payload = Buffer.from(
    JSON.stringify({ c: code.toUpperCase(), e: Date.now() + days * 86_400_000 })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyPortalToken(token: string | null | undefined, code: string): boolean {
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

export function portalCookieName(code: string): string {
  return COOKIE_PREFIX + code.toUpperCase();
}

export function portalCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: PORTAL_COOKIE_MAX_AGE,
  };
}

export async function hasPortalAccess(code: string): Promise<boolean> {
  const store = await cookies();
  return verifyPortalToken(store.get(portalCookieName(code))?.value, code);
}

// Only callable from a Server Action or Route Handler (cookies can't be set while rendering a page).
export async function grantPortalAccess(code: string): Promise<void> {
  const store = await cookies();
  store.set(portalCookieName(code), createPortalToken(code), portalCookieOptions());
}

// A link for emails: opening it grants access with no typing, because only the
// guest's own inbox received it. Never throws — falls back to the normal sign-in page.
export function portalMagicLink(code: string): string {
  const site = siteUrl();
  try {
    const token = createPortalToken(code, LINK_DAYS);
    return `${site}/api/portal/enter?code=${encodeURIComponent(code)}&t=${encodeURIComponent(token)}`;
  } catch {
    return `${site}/portal?code=${encodeURIComponent(code)}`;
  }
}
