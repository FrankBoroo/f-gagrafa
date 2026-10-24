import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FloatingBookButton } from "@/components/site/FloatingBookButton";
import { Toaster } from "sonner";
import { siteUrl } from "@/lib/env";
import { jsonLd } from "@/lib/json-ld";

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
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
    "Luxury serviced apartments in Spintex, Accra. Studios, one and two bedroom residences, and a signature penthouse — book direct at The Gagrafa.",
  openGraph: {
    title: "The Gagrafa",
    description: "Live Luxuriously, Stay Serenely. Luxury serviced apartments in Spintex, Accra.",
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
  description: "Luxury serviced apartments in Spintex, Accra, Ghana.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Community 20, Spintex",
    addressLocality: "Accra",
    addressCountry: "GH",
  },
  url: siteUrl(),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        <FloatingBookButton />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
