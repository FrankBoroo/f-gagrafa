import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

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
      <p>Visit your Guest Portal any time with your booking code for check-in details, Wi-Fi, and to request services.</p>
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

export async function sendPreArrivalReminder(booking: any, unitName: string) {
  await send({
    to: booking.guest_email,
    subject: `See you soon at The Gagrafa — ${booking.booking_code}`,
    html: `
      <p>Hi ${booking.guest_name},</p>
      <p>Your stay at <strong>${unitName}</strong> starts on <strong>${booking.check_in}</strong> — we're looking forward to hosting you.</p>
      <p>Check-in is from 2:00 PM. Your digital access code and Wi-Fi details will be ready in your Guest Portal:</p>
      <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || ""}/portal/${booking.booking_code}">View your stay details</a></p>
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
      <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || ""}/portal/${booking.booking_code}">Leave a review</a></p>
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
