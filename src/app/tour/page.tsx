import Link from "next/link";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { FilmStrip } from "@/components/site/FilmStrip";
import { Reveal } from "@/components/site/Reveal";
import { INTERIOR_PHOTOS, TOUR_HERO, type StripPhoto } from "@/lib/tour-photos";

export const metadata = {
  title: "Tour — The Gagrafa",
  description:
    "A photo tour of The Gagrafa: our residences, the building, and the Spintex neighbourhood around it.",
};

// Photos change when staff edit them, and the page is cheap to build.
export const dynamic = "force-dynamic";

const PHOTOS_PER_RESIDENCE = 4; // the full set lives on each residence's own page

// Seed data uses stock photos as stand-ins; they don't belong on a tour of the real place.
const isPlaceholder = (src: string) => src.includes("images.unsplash.com");

export default async function TourPage() {
  const supabase = createServiceClient();

  const [{ data: units }, { data: gallery }] = await Promise.all([
    supabase.from("units").select("id, name, images").eq("is_active", true).order("sort_order"),
    // If the Tour table hasn't been created yet this just comes back empty.
    supabase.from("gallery_items").select("*").order("sort_order", { ascending: true }),
  ]);

  const residences: StripPhoto[] = (units ?? []).flatMap((u: { name: string; images: string[] | null }) =>
    (u.images ?? [])
      .filter((src: string) => !isPlaceholder(src))
      .slice(0, PHOTOS_PER_RESIDENCE)
      .map((src: string, i: number) => ({ src, alt: `${u.name}, photo ${i + 1}`, caption: u.name }))
  );

  const fromGallery = (category: "property" | "neighbourhood", fallbackAlt: string): StripPhoto[] =>
    (gallery ?? [])
      .filter((g: { category: string }) => g.category === category)
      .map((g: { image_url: string; caption: string | null }) => ({
        src: g.image_url,
        alt: g.caption ?? fallbackAlt,
        caption: g.caption ?? undefined,
      }));

  const property = fromGallery("property", "The Gagrafa building");
  const neighbourhood = fromGallery("neighbourhood", "The neighbourhood around The Gagrafa");

  return (
    <div>
      {/* Banner: the photo settles in slowly behind a navy wash that keeps the text legible. */}
      <section className="relative flex h-[78svh] min-h-[520px] items-end overflow-hidden bg-navy">
        <Image
          src={TOUR_HERO.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="animate-slow-zoom object-cover motion-reduce:animate-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/45 to-navy/20" aria-hidden="true" />
        <div className="container-gagrafa relative pb-16 md:pb-24">
          <p className="text-xs uppercase tracking-[0.3em] text-champagne-light">Take a tour</p>
          <h1 className="mt-4 max-w-3xl text-5xl leading-[1.05] text-ivory md:text-7xl">Step inside The Gagrafa</h1>
          <p className="mt-6 max-w-xl text-lg text-ivory/80">
            Serviced apartments in Spintex, Community 20. Calm rooms, considered finishes, and the city a short drive away.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/booking" className="btn-gold">Book Your Stay</Link>
            <a href="#inside" className="btn-secondary border-ivory/30 text-ivory hover:border-ivory/60 hover:bg-ivory/10">
              Start the tour
            </a>
          </div>
        </div>
        <a
          href="#inside"
          aria-label="Scroll to the photos"
          className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-ivory/60 transition-colors hover:text-ivory md:block"
        >
          <ChevronDown size={28} className="animate-pulse motion-reduce:animate-none" />
        </a>
      </section>

      <section className="container-gagrafa grid gap-10 py-24 md:grid-cols-12 md:py-32">
        <Reveal className="md:col-span-5">
          <h2 className="text-3xl leading-tight md:text-4xl">
            Thoughtfully designed spaces, a short drive from the city&rsquo;s business district.
          </h2>
        </Reveal>
        <Reveal delay={100} className="space-y-5 text-navy/70 md:col-span-6 md:col-start-7">
          <p>
            Sleek, modern finishes, state-of-the-art amenities and flexible living, with fully and
            semi-furnished apartments. Every detail is there for your comfort, convenience and peace of mind.
          </p>
          <p>
            We balance tranquillity with access: an escape from the daily grind without giving up
            connectivity. Explore the culture of Greater Accra, or simply unwind in your own private sanctuary.
          </p>
        </Reveal>
      </section>

      <div className="space-y-24 pb-24 md:space-y-32 md:pb-32">
        <Reveal>
          <FilmStrip
            id="inside"
            eyebrow="Interiors"
            title="Inside The Gagrafa"
            description="Living rooms, kitchens, dining corners and bedrooms, photographed in our residences."
            photos={INTERIOR_PHOTOS}
          />
        </Reveal>
        {residences.length > 0 && (
          <Reveal>
            <FilmStrip
              eyebrow="Residences"
              title="Choose your residence"
              description="From the studio to the penthouse. Each residence has its full gallery on its own page."
              photos={residences}
            />
          </Reveal>
        )}
        {property.length > 0 && (
          <Reveal>
            <FilmStrip eyebrow="The property" title="The building" photos={property} />
          </Reveal>
        )}
        {neighbourhood.length > 0 && (
          <Reveal>
            <FilmStrip
              eyebrow="The neighbourhood"
              title="Around Spintex"
              description="Community 20, Spintex: quiet streets, with the airport and Accra's business district within easy reach."
              photos={neighbourhood}
            />
          </Reveal>
        )}
      </div>

      <section className="bg-navy py-24 text-ivory">
        <div className="container-gagrafa flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-champagne-light">Live luxuriously, stay serenely</p>
            <h2 className="mt-3 text-3xl md:text-4xl">Your residence is ready when you are.</h2>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/booking" className="btn-gold">Book Your Stay</Link>
            <Link href="/units" className="btn-secondary border-ivory/30 text-ivory hover:border-ivory/60 hover:bg-ivory/10">
              View residences
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
