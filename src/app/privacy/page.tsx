export const metadata = { title: "Privacy Policy — The Gagrafa" };

export default function PrivacyPage() {
  return (
    <div className="container-gagrafa max-w-3xl py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">Legal</p>
      <h1 className="mt-3 text-4xl md:text-5xl">Privacy Policy</h1>
      <p className="mt-4 text-sm text-navy/50">Last updated: {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</p>

      <div className="mt-12 space-y-10 text-navy/70">
        <Section title="1. What we collect">
          <p>When you book a stay, contact us, or use the Guest Portal, we collect:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Name, email address, and phone number</li>
            <li>Booking details — dates, residence, guest count, special requests</li>
            <li>Payment confirmation details from Paystack (we never store full card numbers)</li>
            <li>Messages you send us via the contact form or service requests</li>
          </ul>
        </Section>

        <Section title="2. How we use it">
          <ul className="list-disc space-y-2 pl-5">
            <li>To create and manage your booking, and provide access to the Guest Portal</li>
            <li>To send booking confirmations and, where provided, WhatsApp updates</li>
            <li>To respond to service requests and contact-form messages</li>
            <li>To improve our property and service based on reviews and feedback</li>
          </ul>
        </Section>

        <Section title="3. Who we share it with">
          <p>We share limited data with the third parties that power our booking system:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li><strong>Paystack</strong> — to process payments (card, Mobile Money, bank transfer)</li>
            <li><strong>Supabase</strong> — our database and authentication provider, which stores your booking and account data securely</li>
            <li><strong>Resend</strong> — to deliver booking confirmation and notification emails</li>
            <li><strong>Twilio (WhatsApp)</strong> — to deliver booking confirmations by WhatsApp, where applicable</li>
          </ul>
          <p className="mt-3">
            We do not sell guest data, and we don&rsquo;t share it with anyone beyond what&rsquo;s
            needed to run your stay and the services above.
          </p>
        </Section>

        <Section title="4. How long we keep it">
          <p>
            Booking and payment records are kept for as long as needed to meet our
            accounting and legal obligations. You can request deletion of your contact
            details at any time, subject to records we&rsquo;re required to retain.
          </p>
        </Section>

        <Section title="5. Your rights">
          <p>
            You can request a copy of the personal data we hold about you, ask us to
            correct it, or ask us to delete it where we&rsquo;re not required to keep it, by
            emailing{" "}
            <a href="mailto:reservations@thegagrafa.com" className="text-champagne-dark underline">
              reservations@thegagrafa.com
            </a>.
          </p>
        </Section>

        <Section title="6. Cookies">
          <p>
            Our website uses only the essential cookies needed to keep you signed in to
            the Guest Portal or admin dashboard. We don&rsquo;t use third-party advertising
            or tracking cookies.
          </p>
        </Section>

        <Section title="7. Changes to this policy">
          <p>
            We may update this policy from time to time; the &ldquo;last updated&rdquo; date above
            reflects the most recent revision.
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
