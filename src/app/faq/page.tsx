import { CANCELLATION_POLICY } from "@/lib/booking/cancellation-policy";
import { MIN_NIGHTS } from "@/lib/booking/stay-limits";
import { MONTHLY_MIN_NIGHTS } from "@/lib/booking/stay-price";

export const metadata = { title: "FAQ — The Gagrafa" };

const faqs = [
  {
    q: "What time is check-in and check-out?",
    a: "Check-in is from 2:00 PM and check-out is by 11:00 AM.",
  },
  {
    q: "What's your cancellation policy?",
    a: `${CANCELLATION_POLICY.join(" ")} Refunds are returned to the original payment method within 5–10 business days.`,
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept card payments, MTN Mobile Money and Vodafone Cash through our secure checkout, as well as cash or bank transfer for bookings made directly with our team.",
  },
  {
    q: "Can I reserve with a down payment?",
    a: "Yes. You can pay a down payment now, shown at checkout, to secure your dates, and pay the rest by arrival. Refunds follow our cancellation policy and are based on the amount you've actually paid.",
  },
  {
    q: "Is there a minimum stay?",
    a: `The minimum stay is ${MIN_NIGHTS} nights. Monthly rates apply automatically to stays of ${MONTHLY_MIN_NIGHTS} nights or more, on every apartment except the Studio.`,
  },
  {
    q: "Can you arrange breakfast or an airport transfer?",
    a: "Yes, both are available on request. Add a note in Special Requests during booking, or message us through the Guest Portal once your stay is confirmed.",
  },
];

export default function FAQPage() {
  return (
    <div className="container-gagrafa max-w-3xl py-24">
      <p className="eyebrow">Need to know</p>
      <h1 className="mt-3 text-4xl font-normal md:text-5xl">Frequently Asked Questions</h1>

      <div className="mt-14 divide-y divide-navy/10 border-t border-navy/10">
        {faqs.map((item) => (
          <details key={item.q} className="group py-6">
            <summary className="flex cursor-pointer list-none items-center justify-between text-lg">
              {item.q}
              <span className="ml-4 shrink-0 text-champagne-ink transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-navy/70">{item.a}</p>
          </details>
        ))}
      </div>

      <p className="mt-14 text-navy/70">
        Can&rsquo;t find what you&rsquo;re looking for?{" "}
        <a href="/contact" className="text-champagne-ink underline">Get in touch</a>.
      </p>
    </div>
  );
}
