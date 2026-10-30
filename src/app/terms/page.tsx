import { CANCELLATION_POLICY } from "@/lib/booking/cancellation-policy";
import { formatDate } from "@/lib/format";
import { getPublicSettings } from "@/lib/site-settings";

export const metadata = { title: "Terms & Conditions — The Gagrafa" };

// Change this whenever the wording below changes.
const LAST_UPDATED = "2026-10-24";

export default async function TermsPage() {
  const { contact_email, pricing } = await getPublicSettings();
  return (
    <div className="container-gagrafa max-w-3xl py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">Legal</p>
      <h1 className="mt-3 text-4xl md:text-5xl">Terms & Conditions</h1>
      <p className="mt-4 text-sm text-navy/50">Last updated: {formatDate(LAST_UPDATED)}</p>

      <div className="prose-gagrafa mt-12 space-y-10 text-navy/70">
        <Section title="1. Bookings">
          <p>
            A booking is confirmed once payment is received and a confirmation email with
            your booking code has been sent. Booking details (dates, guest count, rate)
            are fixed at the time of confirmation; changes are subject to availability
            and may incur a rate difference.
          </p>
        </Section>

        <Section title="2. Cancellations & Refunds">
          <ul className="list-disc space-y-2 pl-5">
            {CANCELLATION_POLICY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-3">
            Refunds are based on the amount you have actually paid, including any down
            payment. Refunds are issued to the original payment method and may take 5–10 business
            days to reflect, depending on your bank or Mobile Money provider.
          </p>
        </Section>

        <Section title="3. Payment">
          <p>
            Full payment is required at the time of booking to confirm a reservation,
            processed securely through Paystack (card, Mobile Money) or, for bookings
            made directly with our team, by cash or bank transfer. You may instead reserve
            with a down payment, shown at checkout, and pay the remaining balance before or
            on arrival.{" "}
            {pricing.currency === "USD"
              ? "Rates are shown in US dollars (USD). Online payments are charged in Ghana cedis (GHS) at the exchange rate shown at checkout."
              : "Rates are quoted in Ghana cedis (GHS)."}
          </p>
        </Section>

        <Section title="4. House Rules">
          <ul className="list-disc space-y-2 pl-5">
            <li>No smoking inside any residence.</li>
            <li>Quiet hours are 10:00 PM – 7:00 AM.</li>
            <li>Occupancy may not exceed the maximum guests stated for the residence booked.</li>
            <li>Pets are not permitted, with the exception of registered service animals.</li>
            <li>Guests are responsible for any damage caused during their stay beyond normal wear and tear.</li>
          </ul>
        </Section>

        <Section title="5. Liability">
          <p>
            The Gagrafa takes reasonable care to maintain a safe property but is not
            liable for loss, theft, or damage to personal belongings except where
            caused by our negligence. Guests are encouraged to use in-room safes where
            provided.
          </p>
        </Section>

        <Section title="6. Changes to These Terms">
          <p>
            We may update these terms from time to time. Changes apply to bookings made
            after the update date; your original booking terms remain those in effect
            when you booked.
          </p>
        </Section>

        <Section title="7. Governing Law">
          <p>
            These terms are governed by the laws of the Republic of Ghana.
          </p>
        </Section>

        <Section title="8. Contact">
          <p>
            Questions about these terms can be sent to{" "}
            <a href={`mailto:${contact_email}`} className="text-champagne-dark underline">
              {contact_email}
            </a>.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl text-navy">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
