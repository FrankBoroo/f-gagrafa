import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { portalMagicLink } from "@/lib/portal-session";

// Every send here is best-effort: guarded by RESEND_API_KEY, wrapped in
// try/catch, and never thrown back to the caller. A missing or bad key
// should never block a booking, a service request, or a contact message —
// those are already saved to the database before any of these run.

function fromAddress() {
  return process.env.RESEND_FROM_EMAIL || "The Gagrafa <onboarding@resend.dev>";
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
  return process.env.ADMIN_NOTIFICATION_EMAIL || process.env.RESEND_FROM_EMAIL || "reservations@thegagrafa.com";
}

async function send(args: { to: string; subject: string; html: string; replyTo?: string }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`Resend not configured — skipped email "${args.subject}" to ${args.to}`);
    return;
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: fromAddress(),
      to: args.to,
      replyTo: args.replyTo,
      subject: args.subject,
      html: args.html,
    });
  } catch (err) {
    console.error(`Resend send failed ("${args.subject}"):`, err);
  }
}

export async function sendBookingConfirmationEmail(booking: any, unitName: string) {
  await send({
    to: booking.guest_email,
    subject: `Booking confirmed — ${booking.booking_code}`,
    html: `
      <p>Hi ${booking.guest_name},</p>
      <p>Your stay at <strong>The Gagrafa</strong> is confirmed.</p>
      <p>
        <strong>Booking code:</strong> ${booking.booking_code}<br/>
        <strong>Residence:</strong> ${unitName}<br/>
        <strong>Check-in:</strong> ${booking.check_in}<br/>
        <strong>Check-out:</strong> ${booking.check_out}<br/>
        <strong>Total paid:</strong> ${booking.currency} ${Number(booking.total_amount).toLocaleString()}
      </p>
      <p><a href="${portalMagicLink(booking.booking_code)}">Open your Guest Portal</a> for check-in details, Wi-Fi, and to request services. You can also sign in any time with your booking code and the email or phone you booked with.</p>
      <p>— The Gagrafa</p>
    `,
  });
}

export async function sendAdminNewBookingNotification(booking: any, unitName: string) {
  await send({
    to: await adminAddress(),
    subject: `New booking: ${booking.booking_code} (${unitName})`,
    replyTo: booking.guest_email,
    html: `
      <p>A new booking was just started.</p>
      <p>
        <strong>Code:</strong> ${booking.booking_code}<br/>
        <strong>Guest:</strong> ${booking.guest_name} (${booking.guest_email}, ${booking.guest_phone ?? "no phone"})<br/>
        <strong>Residence:</strong> ${unitName}<br/>
        <strong>Dates:</strong> ${booking.check_in} → ${booking.check_out}<br/>
        <strong>Total:</strong> ${booking.currency} ${Number(booking.total_amount).toLocaleString()}<br/>
        <strong>Payment status:</strong> ${booking.payment_status}
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
      <p>${reason}</p>
      <p>
        <strong>Code:</strong> ${booking.booking_code}<br/>
        <strong>Guest:</strong> ${booking.guest_name} (${booking.guest_email}, ${booking.guest_phone ?? "no phone"})<br/>
        <strong>Residence:</strong> ${unitName}<br/>
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
    ? `<p>A refund of <strong>${booking.currency} ${refund.amount.toLocaleString()}</strong> has been issued to ${METHOD_LABEL[refund.method] ?? refund.method}.${
        refund.method === "paystack" ? " It can take 5–10 business days to appear on your statement." : ""
      }</p>`
    : "<p>No refund applies to this cancellation under our cancellation policy.</p>";

  await send({
    to: booking.guest_email,
    subject: `Your booking ${booking.booking_code} has been cancelled`,
    html: `
      <p>Hi ${booking.guest_name},</p>
      <p>Your booking <strong>${booking.booking_code}</strong> for ${unitName} (${booking.check_in} → ${booking.check_out}) has been cancelled.</p>
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
      <p>Hi ${booking.guest_name},</p>
      <p>The dates for your stay at <strong>${unitName}</strong> have been updated:</p>
      <p>
        <strong>Check-in:</strong> ${booking.check_in}<br/>
        <strong>Check-out:</strong> ${booking.check_out}<br/>
        <strong>Total:</strong> ${booking.currency} ${Number(booking.total_amount).toLocaleString()}
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
        <strong>Guest:</strong> ${booking.guest_name}<br/>
        <strong>Dates:</strong> ${booking.check_in} → ${booking.check_out}<br/>
        <strong>Reason:</strong> ${reason || "—"}
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
      <p>Hi ${name || "there"},</p>
      <p>You've been invited to join The Gagrafa team as <strong>${role}</strong>.</p>
      <p><a href="${link}">Accept the invitation and set your password</a></p>
      <p>This link works once and expires soon. If it has expired, ask an admin to send you a new one.</p>
      <p>— The Gagrafa</p>
    `,
  });
}

export async function sendPreArrivalReminder(booking: any, unitName: string) {
  await send({
    to: booking.guest_email,
    subject: `See you soon at The Gagrafa — ${booking.booking_code}`,
    html: `
      <p>Hi ${booking.guest_name},</p>
      <p>Your stay at <strong>${unitName}</strong> starts on <strong>${booking.check_in}</strong> — we're looking forward to hosting you.</p>
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
      <p>Hi ${booking.guest_name},</p>
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
    html: `<p>From: ${name} (${email})</p><p>${message.replace(/\n/g, "<br/>")}</p>`,
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
        <strong>Guest:</strong> ${booking?.guest_name ?? "unknown"}<br/>
        <strong>Type:</strong> ${serviceRequest.type}<br/>
        <strong>Details:</strong> ${serviceRequest.description ?? "—"}
      </p>
    `,
  });
}
