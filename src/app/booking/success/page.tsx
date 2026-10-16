import Link from "next/link";
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { confirmPaymentByReference } from "@/lib/booking-payment";
import { formatCurrency } from "@/lib/utils";

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
      <StatusScreen
        icon={<HelpCircle className="text-navy/40" size={48} />}
        title="No booking reference found"
        body="If you completed a payment, check your email for confirmation, or look up your stay in the Guest Portal using your booking code."
        ctaHref="/portal"
        ctaLabel="Go to Guest Portal"
      />
    );
  }

  const result = await confirmPaymentByReference(reference);

  if (result.outcome === "not_found") {
    return (
      <StatusScreen
        icon={<XCircle className="text-red-500" size={48} />}
        title="Booking not found"
        body="We couldn't find a booking matching this reference. Contact us if you believe a payment was taken."
        ctaHref="/contact"
        ctaLabel="Contact us"
      />
    );
  }

  if (result.outcome === "failed") {
    return (
      <StatusScreen
        icon={<XCircle className="text-red-500" size={48} />}
        title="Payment not completed"
        body="Your payment wasn't completed, so you haven't been charged. We hold your dates for about 30 minutes, then release them. You're welcome to start a new booking whenever you're ready."
        ctaHref="/booking"
        ctaLabel="Start a new booking"
      />
    );
  }

  if (result.outcome === "needs_review") {
    return (
      <StatusScreen
        icon={<HelpCircle className="text-champagne" size={48} />}
        title="Payment received — we need to confirm your dates"
        body="Your payment went through, but your dates were released while it was processing and have since been booked. Our team has been alerted and will contact you shortly with other dates or a full refund. Please keep your booking code."
        code={result.booking.booking_code}
        ctaHref="/contact"
        ctaLabel="Contact us"
      />
    );
  }

  if (result.outcome === "closed") {
    return (
      <StatusScreen
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
    <StatusScreen
      icon={<CheckCircle2 className="text-champagne" size={48} />}
      title={isDeposit ? "Reservation Confirmed" : "Booking Confirmed"}
      body={
        isDeposit
          ? `Thank you — your deposit of ${formatCurrency(deposit, booking.currency)} is received and your dates are reserved. The remaining ${formatCurrency(balance, booking.currency)} is due at check-in. A confirmation has been sent to your email.`
          : "Thank you — a confirmation has been sent to your email. Keep your booking code handy to access your Guest Portal."
      }
      code={result.booking.booking_code}
      ctaHref={`/portal?code=${result.booking.booking_code}`}
      ctaLabel="Go to Guest Portal"
    />
  );
}

function StatusScreen({
  icon, title, body, code, ctaHref, ctaLabel,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  code?: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="container-gagrafa flex min-h-[70vh] max-w-xl flex-col items-center py-24 text-center">
      {icon}
      <h1 className="mt-6 text-3xl">{title}</h1>
      <p className="mt-4 text-navy/60">{body}</p>
      {code && (
        <p className="mt-6 rounded-full border border-champagne/40 bg-champagne/10 px-6 py-3 font-display text-xl tracking-wide">
          {code}
        </p>
      )}
      <Link href={ctaHref} className="btn-primary mt-10">
        {ctaLabel}
      </Link>
    </div>
  );
}
