import Link from "next/link";
import { getPublicSettings } from "@/lib/site-settings";

export async function SiteFooter() {
  const settings = await getPublicSettings();
  return (
    <footer className="border-t border-navy/10 bg-navy text-ivory">
      <div className="container-gagrafa grid gap-10 py-16 md:grid-cols-4">
        <div>
          <p className="font-display text-xl">The Gagrafa</p>
          <p className="mt-3 text-sm text-ivory/60">Live Luxuriously, Stay Serenely.</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-champagne">Explore</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-ivory/70">
            <Link href="/units">Residences</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-champagne">Guests</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-ivory/70">
            <Link href="/portal">Guest Portal</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy Policy</Link>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-champagne">Visit</p>
          <p className="mt-3 text-sm text-ivory/70">{settings.address}</p>
          {settings.contact_email && <p className="mt-2 text-sm text-ivory/70">{settings.contact_email}</p>}
          {settings.contact_phone && <p className="mt-1 text-sm text-ivory/70">{settings.contact_phone}</p>}
        </div>
      </div>
      <div className="border-t border-ivory/10 py-6 text-center text-xs text-ivory/40">
        © {new Date().getFullYear()} The Gagrafa. All rights reserved.
      </div>
    </footer>
  );
}
