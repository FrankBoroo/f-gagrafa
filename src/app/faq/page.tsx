export const metadata = { title: "FAQ — The Gagrafa" };

const faqs = [
  {
    q: "What time is check-in and check-out?",
    a: "Check-in is from 2:00 PM and check-out is by 11:00 AM. Early check-in or late check-out can be arranged through the Guest Portal or front desk, subject to availability.",
  },
  {
    q: "What's your cancellation policy?",
    a: "Cancellations made at least 7 days before check-in receive a full refund. Cancellations within 7 days are refunded 50%, and bookings cancelled within 48 hours of check-in or after check-in are non-refundable. Refunds are returned to the original payment method within 5–10 business days.",
  },
  {
    q: "Is parking available?",
    a: "Yes — secure, gated parking is available for all guests at no additional cost. Let us know if you need space for more than one vehicle.",
  },
  {
    q: "Are pets allowed?",
    a: "Pets aren't currently permitted at The Gagrafa, with the exception of registered service animals.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept card payments, MTN Mobile Money, and Vodafone Cash through our secure checkout, as well as cash or bank transfer for bookings made directly with our team.",
  },
  {
    q: "Can I reserve with a deposit?",
    a: "Yes. When your check-in is at least 7 days away you can choose to pay a deposit now (shown at checkout) to reserve your dates, and pay the remaining balance at check-in. If your check-in is sooner than 7 days away, payment in full is required. Refunds follow our cancellation policy and are based on the amount you've actually paid.",
  },
  {
    q: "Is there a minimum stay?",
    a: "Most residences have a 2-night minimum. Monthly rates are available for stays of 21 nights or longer — contact us for a quote.",
  },
  {
    q: "Do you offer airport pickup?",
    a: "We can arrange airport transfers on request. Add a note in Special Requests during booking, or message us through the Guest Portal once your stay is confirmed.",
  },
  {
    q: "Is Wi-Fi included?",
    a: "Yes, all residences include complimentary high-speed Wi-Fi.",
  },
];

export default function FAQPage() {
  return (
    <div className="container-gagrafa max-w-3xl py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">Need to know</p>
      <h1 className="mt-3 text-4xl md:text-5xl">Frequently Asked Questions</h1>

      <div className="mt-14 divide-y divide-navy/10 border-t border-navy/10">
        {faqs.map((item) => (
          <details key={item.q} className="group py-6">
            <summary className="flex cursor-pointer list-none items-center justify-between text-lg">
              {item.q}
              <span className="ml-4 shrink-0 text-champagne-dark transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-navy/60">{item.a}</p>
          </details>
        ))}
      </div>

      <p className="mt-14 text-navy/60">
        Can&rsquo;t find what you&rsquo;re looking for?{" "}
        <a href="/contact" className="text-champagne-dark underline">Get in touch</a>.
      </p>
    </div>
  );
}
