import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FloatingBookButton } from "@/components/site/FloatingBookButton";
import { Toaster } from "sonner";
import { siteUrl } from "@/lib/env";
import { jsonLd } from "@/lib/json-ld";
import { getPublicSettings } from "@/lib/site-settings";
import { phoneNumbers, telHref } from "@/lib/contact-links";

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

// metadataBase makes the Open Graph image (app/opengraph-image.jpg) URL absolute.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "The Gagrafa — Live Luxuriously, Stay Serenely",
  description:
    "Luxury serviced apartments in Tema, Community 20. Studios, one and two bedroom apartments and a penthouse, by the night or the month. Book direct at The Gagrafa.",
  openGraph: {
    title: "The Gagrafa",
    description: "Live Luxuriously, Stay Serenely. Luxury serviced apartments in Tema, Community 20.",
    type: "website",
    siteName: "The Gagrafa",
    locale: "en_GH",
  },
  twitter: { card: "summary_large_image" },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  name: "The Gagrafa",
  description: "Luxury serviced apartments in Tema, Community 20, Ghana.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Militia Street, Mango Link, Community 20",
    addressLocality: "Tema",
    addressCountry: "GH",
  },
  url: siteUrl(),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPublicSettings();
  const callHref = telHref(phoneNumbers(settings.contact_phone)[0] ?? "");
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationJsonLd) }}
        />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <FloatingBookButton phone={callHref} />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
