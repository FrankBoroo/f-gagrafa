import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import type { Unit } from "@/lib/types";
import { BookingWidget } from "@/components/site/BookingWidget";
import { UnitGallery } from "@/components/site/UnitGallery";

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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.thegagrafa.com";
  const unitJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${unit.name} — The Gagrafa`,
    description: unit.short_description ?? unit.description,
    image: unit.images?.[0],
    url: `${siteUrl}/units/${unit.slug}`,
    offers: {
      "@type": "Offer",
      price: unit.base_price_per_night,
      priceCurrency: "GHS",
      availability: "https://schema.org/InStock",
      url: `${siteUrl}/units/${unit.slug}`,
    },
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(unitJsonLd) }}
      />
      <div className="container-gagrafa pt-8">
        <UnitGallery images={unit.images ?? []} name={unit.name} />
      </div>

      <div className="container-gagrafa grid gap-16 py-16 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">
            {unit.bedrooms === 0 ? "Studio" : `${unit.bedrooms} Bedroom`}
          </p>
          <h1 className="mt-3 text-4xl md:text-5xl">{unit.name}</h1>
          <p className="mt-6 max-w-2xl text-navy/70">{unit.description}</p>

          <div className="mt-10 grid grid-cols-2 gap-6 border-y border-navy/10 py-8 sm:grid-cols-4">
            <Stat label="Guests" value={String(unit.max_guests)} />
            <Stat label="Bedrooms" value={String(unit.bedrooms)} />
            <Stat label="Bathrooms" value={String(unit.bathrooms)} />
            <Stat label="Size" value={unit.size_sqm ? `${unit.size_sqm} m²` : "—"} />
          </div>

          <div className="mt-10">
            <h2 className="text-2xl">Amenities</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {unit.amenities?.map((a: string) => (
                <div key={a} className="rounded-lg border border-navy/10 px-4 py-3 text-sm text-navy/70">
                  {a}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <BookingWidget unit={unit} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl">{value}</p>
      <p className="text-xs uppercase tracking-widest text-navy/50">{label}</p>
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
  const { data: unit } = await supabase.from("units").select("name, short_description").eq("slug", slug).single();
  return { title: unit ? `${unit.name} — The Gagrafa` : "The Gagrafa" };
}
