import Link from "next/link";
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { confirmPaymentByReference } from "@/lib/booking-payment";

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
        body={`Your reservation (${result.booking.booking_code}) is saved as pending, but the payment ${result.reason}. You can try paying again from the Guest Portal.`}
        ctaHref={`/portal/${result.booking.booking_code}`}
        ctaLabel="View my reservation"
      />
    );
  }

  return (
    <StatusScreen
      icon={<CheckCircle2 className="text-champagne" size={48} />}
      title="Booking Confirmed"
      body="Thank you — a confirmation has been sent to your email. Keep your booking code handy to access your Guest Portal."
      code={result.booking.booking_code}
      ctaHref={`/portal/${result.booking.booking_code}`}
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
