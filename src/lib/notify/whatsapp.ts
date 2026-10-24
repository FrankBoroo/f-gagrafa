import "server-only";
import { serverEnv } from "@/lib/env.server";
import { log } from "@/lib/logger";

// Sends via Twilio's WhatsApp API using plain fetch (no SDK dependency).
// Best-effort like email.ts: guarded, never throws back to the caller.
//
// Setup note: Twilio's WhatsApp sandbox requires the recipient to have
// texted the sandbox's join code at least once before it can message them.
// For production you need a Meta-approved WhatsApp Business sender number —
// see https://www.twilio.com/docs/whatsapp for the verification process.
// Swap this file out if you use the WhatsApp Business API directly instead.

function isConfigured() {
  return Boolean(
    serverEnv.TWILIO_ACCOUNT_SID &&
    serverEnv.TWILIO_AUTH_TOKEN &&
    serverEnv.TWILIO_WHATSAPP_FROM
  );
}

function toWhatsAppAddress(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.startsWith("whatsapp:") ? digits : `whatsapp:${digits}`;
}

export async function sendWhatsAppMessage(toPhone: string, body: string) {
  if (!isConfigured()) {
    log.warn("whatsapp.skipped_not_configured");
    return;
  }

  try {
    const sid = serverEnv.TWILIO_ACCOUNT_SID!;
    const auth = Buffer.from(`${sid}:${serverEnv.TWILIO_AUTH_TOKEN}`).toString("base64");

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: serverEnv.TWILIO_WHATSAPP_FROM!,
        To: toWhatsAppAddress(toPhone),
        Body: body,
      }),
    });

    if (!res.ok) {
      log.error("whatsapp.send_failed", { status: res.status, body: await res.text() });
    }
  } catch (err) {
    log.error("whatsapp.send_failed", undefined, err);
  }
}

export async function sendBookingConfirmationWhatsApp(booking: any, unitName: string) {
  if (!booking.guest_phone) return;
  await sendWhatsAppMessage(
    booking.guest_phone,
    `The Gagrafa: your booking ${booking.booking_code} for ${unitName} (${booking.check_in} → ${booking.check_out}) is confirmed. Reply here or visit your Guest Portal for check-in details.`
  );
}
