import { ContactForm } from "@/components/site/ContactForm";
import { MapEmbed } from "@/components/site/MapEmbed";
import { phoneNumbers, telHref } from "@/lib/contact-links";
import { getPublicSettings } from "@/lib/site-settings";

export const metadata = { title: "Contact — The Gagrafa" };

export default async function ContactPage() {
  const settings = await getPublicSettings();
  const phones = phoneNumbers(settings.contact_phone);
  const details = [
    { label: "Address", value: settings.address },
    { label: "Email", value: settings.contact_email },
    { label: "Reception hours", value: settings.reception_hours },
  ].filter((d) => d.value);

  return (
    <div className="container-gagrafa py-24">
      <p className="eyebrow">Get in touch</p>
      <h1 className="mt-3 text-4xl md:text-5xl">Contact Us</h1>
      <p className="mt-4 max-w-xl text-navy/60">
        Questions about a stay, a group booking, or anything else — reach out and
        we&rsquo;ll get back to you shortly.
      </p>

      <div className="mt-14 grid gap-12 lg:grid-cols-2">
        <div className="space-y-8">
          <ContactForm />

          <div className="card p-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {details.map((d) => (
                <div key={d.label}>
                  <p className="text-xs uppercase tracking-widest text-navy/40">{d.label}</p>
                  <p className="mt-1 text-sm text-navy/80">{d.value}</p>
                </div>
              ))}
              {phones.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-navy/60">Phone</p>
                  {phones.map((phone: string) => {
                    const href = telHref(phone);
                    return (
                      <p key={phone} className="mt-1 text-sm text-navy/80">
                        {href ? <a href={href}>{phone}</a> : phone}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="h-[320px] overflow-hidden rounded-xl border border-navy/10 lg:h-auto lg:min-h-full">
          <MapEmbed />
        </div>
      </div>
    </div>
  );
}
