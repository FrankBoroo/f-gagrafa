import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Unit } from "@/lib/types";
import { AmenityPhotos } from "@/components/site/AmenityPhotos";
import { BookingWidget } from "@/components/site/BookingWidget";
import { OtherApartments } from "@/components/site/OtherApartments";
import { UnitGallery } from "@/components/site/UnitGallery";
import { coverImage, priceParts, unitFacts } from "@/lib/apartment-facts";
import { CANCELLATION_POLICY } from "@/lib/booking/cancellation-policy";
import { siteUrl } from "@/lib/env";
import { jsonLd } from "@/lib/json-ld";
import { getPublicSettings } from "@/lib/site-settings";

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("units")
    .select("*")
    .eq("slug", slug)
    .single<Unit>();

  if (!unit) notFound();
  const { pricing, address } = await getPublicSettings();
  const { data: others } = await supabase
    .from("units")
    .select("*")
    .eq("is_active", true)
    .neq("slug", slug)
    .order("sort_order");

  const site = siteUrl();
  const unitJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${unit.name} — The Gagrafa`,
    description: unit.short_description ?? unit.description,
    image: new URL(coverImage(unit), site).href,
    url: `${site}/units/${unit.slug}`,
    offers: {
      "@type": "Offer",
      price: unit.base_price_per_night,
      priceCurrency: pricing.currency,
      availability: "https://schema.org/InStock",
      url: `${site}/units/${unit.slug}`,
    },
  };

  const [guests, stay, size] = unitFacts(unit);
  const amenities = unit.amenities ?? [];

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(unitJsonLd) }}
      />
      <div className="px-1.5 pt-1.5">
        <UnitGallery images={unit.images ?? []} name={unit.name} />
      </div>

      <div className="container-gagrafa grid gap-12 py-12 md:py-16 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
        <div>
          <nav aria-label="Breadcrumb" className="text-[0.7rem] uppercase tracking-[0.2em] text-navy/65">
            <Link href="/" className="hover:text-navy">Home</Link> /{" "}
            <Link href="/units" className="hover:text-navy">Apartments</Link> / {unit.name}
          </nav>
          <h1 className="mt-4 text-4xl font-normal md:text-6xl">{unit.name}</h1>
          <p className="mt-3 text-lg">{priceParts(unit, pricing.currency).join(" · ")}</p>

          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-5 text-sm">
            <Fact label="Guests" value={guests} />
            <Fact label="Stay" value={stay} />
            {size && <Fact label="Size" value={size} />}
            <Fact label="Building" value="Pool · Gym · Lounge" />
          </dl>

          {unit.description && (
            <p className="mt-10 max-w-2xl border-t border-sand pt-10 text-navy/75">{unit.description}</p>
          )}

          {amenities.length > 0 && (
            <div className="mt-10 border-t border-sand pt-10">
              <h2 className="text-2xl font-normal">In the apartment</h2>
              <ul className="mt-5 grid gap-2 text-sm text-navy/75 sm:grid-cols-2">
                {amenities.map((a: string) => <li key={a}>{a}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-10 border-t border-sand pt-10">
            <h2 className="text-2xl font-normal">At the building</h2>
            <div className="mt-6">
              <AmenityPhotos sizes="(min-width: 1024px) 18vw, (min-width: 640px) 33vw, 100vw" />
            </div>
          </div>

          <div className="mt-10 border-t border-sand pt-10">
            <h2 className="text-2xl font-normal">Good to know</h2>
            <ul className="mt-4 max-w-2xl space-y-2 text-sm text-navy/75">
              {CANCELLATION_POLICY.map((line: string) => <li key={line}>{line}</li>)}
              <li>Check-in from 2 PM, check-out by 11 AM.</li>
            </ul>
            <p className="mt-4 text-sm text-navy/75">
              {address} ·{" "}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noreferrer"
                className="link-underline text-navy"
              >
                Map
              </a>
            </p>
          </div>
        </div>

        <div id="reserve" className="scroll-mt-24">
          <BookingWidget unit={unit} currency={pricing.currency} />
        </div>
      </div>

      <OtherApartments units={(others as Unit[] | null) ?? []} currency={pricing.currency} />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: unit } = await supabase.from("units").select("name, short_description, images").eq("slug", slug).single<Pick<Unit, "name" | "short_description" | "images">>();
  if (!unit) return { title: "The Gagrafa" };
  const title = `${unit.name} — The Gagrafa`;
  const description = unit.short_description ?? undefined;
  const image = unit.images?.[0];
  return {
    title,
    description,
    // Share previews use the unit's main photo; without one the site-wide image applies.
    openGraph: { title, description, url: `/units/${slug}`, ...(image ? { images: [image] } : {}) },
  };
}
