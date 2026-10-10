import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

// Three lightweight, dependency-free checks — no CAPTCHA/Turnstile keys
// required. Stack them; each catches a different class of bot.

// 1. Honeypot: a field real guests never see or fill (hidden via CSS, not
// `type="hidden"`, so basic bots that only skip hidden inputs still fall for it).
export function isHoneypotTripped(value: string | undefined | null): boolean {
  return Boolean(value && value.trim().length > 0);
}

// 2. Time trap: forms render a timestamp; submitting faster than a human
// could plausibly read+fill the form is a strong bot signal.
export function isSubmittedTooFast(renderedAt: number | undefined, minMs = 2500): boolean {
  if (!renderedAt) return true; // missing the field entirely is itself suspicious
  return Date.now() - renderedAt < minMs;
}

// 3. Rate limit: cap how many rows a given email can create in a time window,
// using the table's own data rather than external infra.
export async function isRateLimited(
  table: "contact_messages" | "bookings",
  emailColumn: "email" | "guest_email",
  email: string,
  windowMinutes = 10,
  maxCount = 3
): Promise<boolean> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(emailColumn, email)
    .gte("created_at", since);

  return (count ?? 0) >= maxCount;
}
