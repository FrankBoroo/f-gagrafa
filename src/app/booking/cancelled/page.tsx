import { CheckCircle2, HelpCircle } from "lucide-react";
import { BookingStatusScreen } from "@/components/site/BookingStatusScreen";
import { isOwnCheckout } from "@/lib/checkout-session";
import { rebookHref, releaseUnpaidHold } from "@/lib/payments/release-hold";
import { isOverLimit } from "@/lib/rate-limit";

export const metadata = { title: "Checkout Cancelled — The Gagrafa", robots: { index: false } };

// Paystack sends the guest here (metadata.cancel_action) when they close the checkout.
// If this browser made the booking and Paystack confirms nothing was paid, the dates are
// released at once instead of after the 30-minute hold.
export default async function BookingCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const { reference } = await searchParams;
  const valid = !!reference && reference.length <= 40 && /^[A-Za-z0-9-]+$/.test(reference);

  // Each visit may ask Paystack about the payment, so the success page's limit applies.
  const release =
    valid && (await isOwnCheckout(reference)) && !(await isOverLimit("paymentCheck"))
      ? await releaseUnpaidHold(reference)
      : null;

  if (release?.outcome === "released") {
    return (
      <BookingStatusScreen
        icon={<CheckCircle2 className="text-champagne" size={48} />}
        title="Checkout cancelled"
        body="You haven't been charged, and we've released the dates you picked. You can try again with the same residence and dates whenever you're ready."
        ctaHref={rebookHref(release.booking)}
        ctaLabel="Try again"
      />
    );
  }

  if (release?.outcome === "kept") {
    return (
      <BookingStatusScreen
        icon={<HelpCircle className="text-champagne" size={48} />}
        title="Your payment may still be processing"
        body="Paystack still shows a payment in progress for this booking, for example a Mobile Money approval on your phone. If it goes through, you'll receive a confirmation by email. If not, your dates are released within 30 minutes."
        code={release.booking?.booking_code}
        ctaHref={`/portal?code=${release.booking?.booking_code ?? ""}`}
        ctaLabel="Check in the Guest Portal"
      />
    );
  }

  return (
    <BookingStatusScreen
      icon={<HelpCircle className="text-navy/40" size={48} />}
      title="Checkout cancelled"
      body="Your payment wasn't completed, so you haven't been charged. Any dates held for you are released within 30 minutes. If you did complete a payment, a confirmation will reach your email."
      ctaHref="/booking"
      ctaLabel="Start a new booking"
    />
  );
}
