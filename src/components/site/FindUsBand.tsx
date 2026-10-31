import Image from "next/image";
import { phoneNumbers, telHref } from "@/lib/contact-links";
import type { PublicSettings } from "@/lib/site-settings";

export function FindUsBand({ settings }: { settings: PublicSettings }) {
  return (
    <section className="relative overflow-hidden bg-navy py-28 text-center text-ivory">
      <Image src="/photos/aerial.jpg" alt="" fill sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-navy/75" aria-hidden="true" />
      <div className="container-gagrafa relative">
        <p className="text-[0.7rem] uppercase tracking-[0.25em] text-champagne-light">Find us</p>
        <h2 className="mx-auto mt-4 max-w-xl text-3xl font-normal leading-snug md:text-4xl">{settings.address}</h2>
        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-ivory/85">
          {phoneNumbers(settings.contact_phone).map((phone: string) => {
            const href = telHref(phone);
            return href ? <a key={phone} href={href} className="py-1 hover:text-ivory">{phone}</a> : <span key={phone}>{phone}</span>;
          })}
          <a href={`mailto:${settings.contact_email}`} className="py-1 hover:text-ivory">{settings.contact_email}</a>
        </p>
      </div>
    </section>
  );
}
