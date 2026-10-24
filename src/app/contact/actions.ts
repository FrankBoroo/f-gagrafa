"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { contactMessageSchema, type ContactMessageInput } from "@/lib/validations";
import { isHoneypotTripped, isSubmittedTooFast, isRateLimited } from "@/lib/spam-protection";
import { sendContactMessageNotification } from "@/lib/email";
import { isOverLimit, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

interface SubmitArgs extends ContactMessageInput {
  honeypot?: string;
  renderedAt?: number;
}

export async function submitContactMessage(input: SubmitArgs) {
  // Bots: silently "succeed" so they don't learn the trap failed.
  if (isHoneypotTripped(input.honeypot) || isSubmittedTooFast(input.renderedAt)) {
    return { ok: true };
  }

  const parsed = contactMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details" };
  }
  const { name, email, message } = parsed.data;

  if (await isOverLimit("contact")) return { ok: false, error: RATE_LIMITED_MESSAGE };

  if (await isRateLimited("contact_messages", email)) {
    return { ok: false, error: "You've sent several messages recently — please wait a bit before sending another." };
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("contact_messages").insert({ name, email, message });
  if (error) {
    log.error("contact.insert_failed", undefined, error);
    return { ok: false, error: "We couldn't send your message. Please try again or email us directly." };
  }

  // Best-effort — the message is already saved above regardless of whether
  // this succeeds, and it resolves the same Settings-configurable admin
  // address as new-booking and service-request alerts.
  await sendContactMessageNotification(name, email, message);

  return { ok: true };
}
