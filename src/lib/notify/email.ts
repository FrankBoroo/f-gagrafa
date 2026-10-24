import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { portalMagicLink } from "@/lib/portal-session";
import { serverEnv } from "@/lib/env.server";
import { bookedPriceSuffix } from "@/lib/booking/pricing";
import { formatMoney } from "@/lib/format";
import { log } from "@/lib/logger";
import { takeToken } from "@/lib/rate-limit";

// Every send here is best-effort: guarded by RESEND_API_KEY, wrapped in
// try/catch, and never thrown back to the caller. A missing or bad key
// should never block a booking, a service request, or a contact message —
// those are already saved to the database before any of these run.

function fromAddress() {
  return serverEnv.RESEND_FROM_EMAIL || "The Gagrafa <onboarding@resend.dev>";
}

// The admin notification address can be set two ways: the Settings page in
// the admin dashboard (property_settings.admin_notification_email), or the
// ADMIN_NOTIFICATION_EMAIL env var as a fallback for before that's filled in.
async function adminAddress(): Promise<string> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("property_settings")
      .select("admin_notification_email")
      .limit(1)
      .maybeSingle();
    if (data?.admin_notification_email) return data.admin_notification_email;
  } catch {
    // property_settings may not exist yet on an older schema — fall through
  }
  return serverEnv.ADMIN_NOTIFICATION_EMAIL || serverEnv.RESEND_FROM_EMAIL || "reservations@thegagrafa.com";
}

// Anything a guest typed (names, messages, request details) is escaped before it goes into
// an email, so it can't inject links or markup into the admin's or a guest's inbox.
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function send(args: { to: string; subject: string; html: string; replyTo?: string }) {
  if (!serverEnv.RESEND_API_KEY) {
    log.warn("email.skipped_not_configured", { subject: args.subject });
    return;
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(serverEnv.RESEND_API_KEY);
    await resend.emails.send({
      from: fromAddress(),
      to: args.to,
      replyTo: args.replyTo,
      subject: args.subject,
      html: args.html,
    });
  } catch (err) {
    log.error("email.send_failed", { subject: args.subject }, err);
  }
}

export async function sendBookingConfirmationEmail(booking: any, unitName: string, paidAmount?: number) {
  const total = Number(booking.total_amount);
  const paid = paidAmount ?? total;
  const balance = Math.max(total - paid, 0);
  const money = (n: number) => formatMoney(n, booking.currency);
  const paymentLines =
    balance > 0.005
      ? `<strong>Deposit paid:</strong> ${money(paid)}<br/><strong>Balance due at check-in:</strong> ${money(balance)}`
      : `<strong>Total paid:</strong> ${money(total)}`;
  const bookedAt = bookedPriceSuffix(booking)
    ? `<br/><strong>Booked price:</strong>${bookedPriceSuffix(booking)}, charged in cedis at $1 = GHS ${booking.exchange_rate}`
    : "";

  await send({
    to: booking.guest_email,
    subject: `Booking confirmed — ${booking.booking_code}`,
    html: `
      <p>Hi ${esc(booking.guest_name)},</p>
      <p>Your stay at <strong>The Gagrafa</strong> is confirmed.</p>
      <p>
        <strong>Booking code:</strong> ${booking.booking_code}<br/>
        <strong>Residence:</strong> ${esc(unitName)}<br/>
        <strong>Check-in:</strong> ${booking.check_in}<br/>
        <strong>Check-out:</strong> ${booking.check_out}<br/>
        ${paymentLines}${bookedAt}
      </p>
      <p><a href="${portalMagicLink(booking.booking_code)}">Open your Guest Portal</a> for check-in details, Wi-Fi, and to request services. You can also sign in any time with your booking code and the email or phone you booked with.</p>
      <p>— The Gagrafa</p>
    `,
  });
}

export async function sendAdminNewBookingNotification(booking: any, unitName: string) {
  await send({
    to: await adminAddress(),
    subject: `New booking: ${booking.booking_code} (${esc(unitName)})`,
    replyTo: booking.guest_email,
    html: `
      <p>A new booking was just started.</p>
      <p>
        <strong>Code:</strong> ${booking.booking_code}<br/>
        <strong>Guest:</strong> ${esc(booking.guest_name)} (${esc(booking.guest_email)}, ${esc(booking.guest_phone ?? "no phone")})<br/>
        <strong>Residence:</strong> ${esc(unitName)}<br/>
        <strong>Dates:</strong> ${booking.check_in} → ${booking.check_out}<br/>
        <strong>Total:</strong> ${formatMoney(Number(booking.total_amount), booking.currency)}${bookedPriceSuffix(booking)}<br/>
        <strong>Payment status:</strong> ${booking.payment_status}
        ${booking.deposit_amount ? `<br/><strong>Deposit due now:</strong> ${formatMoney(Number(booking.deposit_amount), booking.currency)} (balance at check-in)` : ""}
      </p>
    `,
  });
}

export async function sendAdminPaymentConflictAlert(booking: any, unitName: string, reason: string) {
  await send({
    to: await adminAddress(),
    replyTo: booking.guest_email,
    subject: `ACTION NEEDED: paid booking ${booking.booking_code} needs attention`,
    html: `
      <p><strong>A guest has paid, but the booking could not be confirmed automatically.</strong></p>
      <p>${esc(reason)}</p>
      <p>
        <strong>Code:</strong> ${booking.booking_code}<br/>
        <strong>Guest:</strong> ${esc(booking.guest_name)} (${esc(booking.guest_email)}, ${esc(booking.guest_phone ?? "no phone")})<br/>
        <strong>Residence:</strong> ${esc(unitName)}<br/>
        <strong>Dates:</strong> ${booking.check_in} → ${booking.check_out}
      </p>
      <p>Please contact the guest to offer other dates or a full refund.</p>
    `,
  });
}

const METHOD_LABEL: Record<string, string> = {
  paystack: "your original payment method (via Paystack)",
  momo: "Mobile Money",
  cash: "cash",
  bank: "bank transfer",
};

export async function sendBookingCancelledEmail(
  booking: any,
  unitName: string,
  refund: { amount: number; method: string } | null
) {
  const refundLine = refund && refund.amount > 0
    ? `<p>A refund of <strong>${formatMoney(refund.amount, booking.currency)}</strong> has been issued to ${METHOD_LABEL[refund.method] ?? refund.method}.${
        refund.method === "paystack" ? " It can take 5–10 business days to appear on your statement." : ""
      }</p>`
    : "<p>No refund applies to this cancellation under our cancellation policy.</p>";

  await send({
    to: booking.guest_email,
    subject: `Your booking ${booking.booking_code} has been cancelled`,
    html: `
      <p>Hi ${esc(booking.guest_name)},</p>
      <p>Your booking <strong>${booking.booking_code}</strong> for ${esc(unitName)} (${booking.check_in} → ${booking.check_out}) has been cancelled.</p>
      ${refundLine}
      <p>If you have any questions, just reply to this email.</p>
      <p>— The Gagrafa</p>
    `,
  });
}

export async function sendBookingChangedEmail(booking: any, unitName: string) {
  await send({
    to: booking.guest_email,
    subject: `Your booking ${booking.booking_code} has been updated`,
    html: `
      <p>Hi ${esc(booking.guest_name)},</p>
      <p>The dates for your stay at <strong>${esc(unitName)}</strong> have been updated:</p>
      <p>
        <strong>Check-in:</strong> ${booking.check_in}<br/>
        <strong>Check-out:</strong> ${booking.check_out}<br/>
        <strong>Total:</strong> ${formatMoney(Number(booking.total_amount), booking.currency)}
      </p>
      <p><a href="${portalMagicLink(booking.booking_code)}">View your booking</a>. If this isn't what you agreed with us, just reply to this email.</p>
      <p>— The Gagrafa</p>
    `,
  });
}

export async function sendCancellationRequestAlert(booking: any, reason: string) {
  await send({
    to: await adminAddress(),
    subject: `Cancellation request: ${booking.booking_code}`,
    html: `
      <p>A guest has asked to cancel their booking.</p>
      <p>
        <strong>Code:</strong> ${booking.booking_code}<br/>
        <strong>Guest:</strong> ${esc(booking.guest_name)}<br/>
        <strong>Dates:</strong> ${booking.check_in} → ${booking.check_out}<br/>
        <strong>Reason:</strong> ${esc(reason || "—")}
      </p>
      <p>Review it under Admin → Service Requests, then cancel (and refund if due) from Bookings.</p>
    `,
  });
}

export async function sendStaffInviteEmail(email: string, name: string, role: string, link: string) {
  await send({
    to: email,
    subject: "You've been invited to The Gagrafa admin",
    html: `
      <p>Hi ${esc(name || "there")},</p>
      <p>You've been invited to join The Gagrafa team as <strong>${role}</strong>.</p>
      <p><a href="${link}">Accept the invitation and set your password</a></p>
      <p>This link works once and expires soon. If it has expired, ask an admin to send you a new one.</p>
      <p>— The Gagrafa</p>
    `,
  });
}

export async function sendPreArrivalReminder(booking: any, unitName: string, balanceDue = 0) {
  await send({
    to: booking.guest_email,
    subject: `See you soon at The Gagrafa — ${booking.booking_code}`,
    html: `
      <p>Hi ${esc(booking.guest_name)},</p>
      <p>Your stay at <strong>${esc(unitName)}</strong> starts on <strong>${booking.check_in}</strong> — we're looking forward to hosting you.</p>
      ${balanceDue > 0.005 ? `<p><strong>Balance due on arrival:</strong> ${formatMoney(balanceDue, booking.currency)}. You can pay at the front desk by cash, bank transfer or Mobile Money.</p>` : ""}
      <p>Check-in is from 2:00 PM. Your digital access code and Wi-Fi details will be ready in your Guest Portal:</p>
      <p><a href="${portalMagicLink(booking.booking_code)}">View your stay details</a></p>
      <p>— The Gagrafa</p>
    `,
  });
}

export async function sendPostStayReviewRequest(booking: any) {
  await send({
    to: booking.guest_email,
    subject: "How was your stay at The Gagrafa?",
    html: `
      <p>Hi ${esc(booking.guest_name)},</p>
      <p>Thank you for staying with us. We'd love to hear how it went — it takes less than a minute.</p>
      <p><a href="${portalMagicLink(booking.booking_code)}">Leave a review</a></p>
      <p>— The Gagrafa</p>
    `,
  });
}

export async function sendContactMessageNotification(name: string, email: string, message: string) {
  await send({
    to: await adminAddress(),
    replyTo: email,
    subject: `New contact message from ${name}`,
    html: `<p>From: ${esc(name)} (${esc(email)})</p><p>${esc(message).replace(/\n/g, "<br/>")}</p>`,
  });
}

export async function sendServiceRequestNotification(serviceRequest: any, booking: any) {
  await send({
    to: await adminAddress(),
    subject: `Service request: ${serviceRequest.type} — ${booking?.booking_code ?? ""}`,
    html: `
      <p>A guest submitted a service request.</p>
      <p>
        <strong>Booking:</strong> ${booking?.booking_code ?? "unknown"}<br/>
        <strong>Guest:</strong> ${esc(booking?.guest_name ?? "unknown")}<br/>
        <strong>Type:</strong> ${esc(serviceRequest.type)}<br/>
        <strong>Details:</strong> ${esc(serviceRequest.description ?? "—")}
      </p>
    `,
  });
}

// Something broke that a person should look at (a booking or payment failed on our side).
// Capped at 3 per hour per kind, so an outage can't flood the inbox; the logs keep every case.
export async function sendAdminSystemAlert(kind: string, summary: string, details: Record<string, string | number | null | undefined>) {
  if (!(await takeToken("admin-alert", kind, 3, 60 * 60))) return;
  const rows = Object.entries(details)
    .map(([k, v]: [string, string | number | null | undefined]) => `<strong>${esc(k)}:</strong> ${esc(v ?? "—")}`)
    .join("<br/>");
  await send({
    to: await adminAddress(),
    subject: `ALERT: ${summary}`,
    html: `
      <p><strong>${esc(summary)}</strong></p>
      <p>${rows}</p>
      <p>Search the Vercel logs for "${esc(kind)}" to see every occurrence.</p>
    `,
  });
}
