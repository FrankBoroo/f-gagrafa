import { BookingStatusScreen } from "@/components/site/BookingStatusScreen";
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { confirmPaymentByReference } from "@/lib/payments/booking-payment";
import { formatMoney } from "@/lib/format";
import { isOverLimit } from "@/lib/rate-limit";
import { isOwnCheckout } from "@/lib/checkout-session";
import { rebookHref, releaseUnpaidHold } from "@/lib/payments/release-hold";

// Paystack redirects here with ?reference=<our booking code>&trxref=<same>.
// We verify server-side (never trust the redirect alone) before showing success.
export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const params = await searchParams;
  const reference = params.reference ?? params.trxref;

  if (!reference) {
    return (
      <BookingStatusScreen
        icon={<HelpCircle className="text-navy/40" size={48} />}
        title="No booking reference found"
        body="If you completed a payment, check your email for confirmation, or look up your stay in the Guest Portal using your booking code."
        ctaHref="/portal"
        ctaLabel="Go to Guest Portal"
      />
    );
  }

  // Every visit costs a database lookup and a Paystack call, so junk references and
  // repeated reloads stop here. The webhook still confirms a real payment either way.
  const malformed = reference.length > 40 || !/^[A-Za-z0-9-]+$/.test(reference);
  if (malformed || (await isOverLimit("paymentCheck"))) {
    return (
      <BookingStatusScreen
        icon={<HelpCircle className="text-navy/40" size={48} />}
        title={malformed ? "Booking not found" : "Please wait a moment"}
        body={
          malformed
            ? "We couldn't find a booking matching this reference. Contact us if you believe a payment was taken."
            : "We've had a lot of requests from you just now. If you completed a payment it is still being confirmed, and a confirmation will reach your email. You can also look up your stay in the Guest Portal in a few minutes."
        }
        ctaHref={malformed ? "/contact" : "/portal"}
        ctaLabel={malformed ? "Contact us" : "Go to Guest Portal"}
      />
    );
  }

  const result = await confirmPaymentByReference(reference);

  if (result.outcome === "not_found") {
    return (
      <BookingStatusScreen
        icon={<XCircle className="text-red-500" size={48} />}
        title="Booking not found"
        body="We couldn't find a booking matching this reference. Contact us if you believe a payment was taken."
        ctaHref="/contact"
        ctaLabel="Contact us"
      />
    );
  }

  if (result.outcome === "failed") {
    // The guest's own browser: free the dates now so they can try again straight away.
    const release = (await isOwnCheckout(reference)) ? await releaseUnpaidHold(reference) : null;
    return (
      <BookingStatusScreen
        icon={<XCircle className="text-red-500" size={48} />}
        title="Payment not completed"
        body={
          release?.outcome === "released"
            ? "Your payment wasn't completed, so you haven't been charged. You can try again with the same dates now, or choose different ones."
            : "Your payment wasn't completed, so you haven't been charged. We hold your dates for about 30 minutes, then release them. You're welcome to start a new booking whenever you're ready."
        }
        ctaHref={release?.outcome === "released" ? rebookHref(release.booking) : "/booking"}
        ctaLabel={release?.outcome === "released" ? "Try again" : "Start a new booking"}
      />
    );
  }

  if (result.outcome === "needs_review") {
    return (
      <BookingStatusScreen
        icon={<HelpCircle className="text-champagne" size={48} />}
        title="Payment received — we need to confirm your dates"
        body={
          result.booking.cancelled_at
            ? "Your payment went through, but this booking had already been cancelled. Our team has been alerted and will contact you shortly to refund you in full or help you rebook. Please keep your booking code."
            : "Your payment went through, but your dates were released while it was processing and have since been booked. Our team has been alerted and will contact you shortly with other dates or a full refund. Please keep your booking code."
        }
        code={result.booking.booking_code}
        ctaHref="/contact"
        ctaLabel="Contact us"
      />
    );
  }

  if (result.outcome === "closed") {
    return (
      <BookingStatusScreen
        icon={<HelpCircle className="text-navy/40" size={48} />}
        title="This booking has been cancelled"
        body="This booking was cancelled, so there's nothing more to pay. If you were refunded, it can take 5–10 business days to appear. Contact us if you have any questions."
        ctaHref="/contact"
        ctaLabel="Contact us"
      />
    );
  }

  const booking = result.booking;
  const isDeposit = booking.payment_status === "partial";
  const deposit = Number(booking.deposit_amount ?? 0);
  const balance = Math.max(Number(booking.total_amount) - (deposit || Number(booking.total_amount)), 0);

  return (
    <BookingStatusScreen
      icon={<CheckCircle2 className="text-champagne" size={48} />}
      title={isDeposit ? "Reservation Confirmed" : "Booking Confirmed"}
      body={
        isDeposit
          ? `Thank you — your deposit of ${formatMoney(deposit, booking.currency)} is received and your dates are reserved. The remaining ${formatMoney(balance, booking.currency)} is due at check-in. A confirmation has been sent to your email.`
          : "Thank you — a confirmation has been sent to your email. Keep your booking code handy to access your Guest Portal."
      }
      code={result.booking.booking_code}
      ctaHref={`/portal?code=${result.booking.booking_code}`}
      ctaLabel="Go to Guest Portal"
    />
  );
}
