import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AmenityPhotos } from "@/components/site/AmenityPhotos";
import { ApartmentRow } from "@/components/site/ApartmentRow";
import { FindUsBand } from "@/components/site/FindUsBand";
import { HeroSlideshow } from "@/components/site/HeroSlideshow";
import { Reveal } from "@/components/site/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPublicSettings } from "@/lib/site-settings";
import type { Unit } from "@/lib/types";

export default async function HomePage() {
  const supabase = await createClient();
  const settings = await getPublicSettings();
  const { data: units } = await supabase
    .from("units")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div>
      <HeroSlideshow />

      {/* Welcome */}
      <section className="container-gagrafa py-24 md:py-32">
        <Reveal className="text-center">
          <p className="eyebrow">Welcome to The Gagrafa</p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-normal leading-tight md:text-5xl">
            The elegance of a hotel, the ease of a home
          </h2>
        </Reveal>
        <div className="mt-14 grid items-start gap-8 md:grid-cols-[1.2fr_1fr_0.8fr] md:gap-12">
          <Reveal>
            <div className="relative aspect-[4/5] overflow-hidden bg-sand">
              <Image
                src="/photos/welcome-1.jpg"
                alt="Open-plan living room with a caramel sofa, a large blue painting and a wood-panelled kitchen"
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                className="object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-navy/75">
              Fully furnished apartments for business, leisure or a quick getaway. A serene escape, a
              short drive from the city&rsquo;s business district.
            </p>
            <Link href="/about" className="link-underline mt-6">About us</Link>
          </Reveal>
          <Reveal delay={200} className="md:mt-24">
            <div className="relative aspect-[4/3] overflow-hidden bg-sand md:aspect-[4/5]">
              <Image
                src="/photos/welcome-2.jpg"
                alt="Bedroom with a curved headboard, full-height curtains and a colourful painting"
                fill
                sizes="(min-width: 768px) 27vw, 100vw"
                className="object-cover"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Apartments */}
      <section className="bg-sand py-24 md:py-32">
        <div className="container-gagrafa">
          <Reveal>
            <p className="eyebrow">Our apartments</p>
            <h2 className="mt-4 text-3xl font-normal md:text-5xl">Five ways to stay</h2>
          </Reveal>
          {!units?.length && (
            <EmptyState
              className="mt-12"
              title="Apartments coming soon"
              description="We're putting the finishing touches on our listings. Get in touch to plan your stay."
              action={{ href: "/contact", label: "Contact us" }}
            />
          )}
          <div className="mt-14 space-y-16 md:space-y-24">
            {(units as Unit[] | null)?.map((unit: Unit, i: number) => (
              <Reveal key={unit.id}>
                <ApartmentRow unit={unit} currency={settings.pricing.currency} flip={i % 2 === 1} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Amenities */}
      <section className="container-gagrafa py-24 md:py-32">
        <Reveal>
          <p className="eyebrow text-center">Make your stay memorable</p>
          <div className="mt-10">
            <AmenityPhotos />
          </div>
        </Reveal>
      </section>

      <FindUsBand settings={settings} />
    </div>
  );
}
