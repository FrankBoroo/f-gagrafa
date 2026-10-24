import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UnitCard } from "@/components/site/UnitCard";
import { MapEmbed } from "@/components/site/MapEmbed";
import { HeroVideo } from "@/components/site/HeroVideo";
import { Reveal } from "@/components/site/Reveal";
import { getPublicSettings } from "@/lib/site-settings";
import type { Unit } from "@/lib/types";

const amenities = [
  { name: "Infinity Pool", desc: "A quiet rooftop escape above the city." },
  { name: "Fitness Studio", desc: "Fully equipped, open around the clock." },
  { name: "Resident Lounge", desc: "A calm space to work, meet, or unwind." },
  { name: "24/7 Reception", desc: "Concierge and security, day and night." },
  { name: "Backup Power & Water", desc: "Uninterrupted comfort, always." },
  { name: "Secure Parking", desc: "Private, gated parking for every guest." },
];

export default async function HomePage() {
  const supabase = await createClient();
  const settings = await getPublicSettings();
  const { data: units } = await supabase
    .from("units")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .limit(3);

  const { data: featuredReview } = await supabase
    .from("reviews")
    .select("rating, comment, bookings(guest_name)")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div>
      <HeroVideo />

      {/* About */}
      <section id="welcome" className="container-gagrafa scroll-mt-20 py-28">
        <div className="grid gap-12 md:grid-cols-2">
          <Reveal>
            <h2 className="text-3xl md:text-4xl">
              A residence built for the way you actually live.
            </h2>
          </Reveal>
          <Reveal delay={100} className="self-center">
            <p className="text-navy/70">
              The Gagrafa sits quietly on Community 20 in Spintex — close enough to
              Accra&rsquo;s business districts to be convenient, far enough to feel calm.
              Each residence is furnished with the same care as a well-kept home:
              considered materials, dependable utilities, and service that
              anticipates rather than intrudes.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Featured units */}
      <section className="bg-sand py-28">
        <div className="container-gagrafa">
          <Reveal className="flex items-end justify-between">
            <h2 className="text-3xl md:text-4xl">Residences</h2>
            <Link href="/units" className="hidden text-sm text-navy/60 hover:text-navy md:block">
              View all residences →
            </Link>
          </Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {(units as Unit[] | null)?.map((unit: Unit, i: number) => (
              <Reveal key={unit.id} delay={i * 100}>
                <UnitCard unit={unit} currency={settings.pricing.currency} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Amenities */}
      <section className="container-gagrafa py-28">
        <Reveal>
          <h2 className="text-3xl md:text-4xl">On the property</h2>
        </Reveal>
        <div className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 md:grid-cols-3">
          {amenities.map((a, i: number) => (
            <Reveal key={a.name} delay={(i % 3) * 100} className="border-l border-champagne pl-5">
              <p className="text-lg">{a.name}</p>
              <p className="mt-1 text-sm text-navy/60">{a.desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Testimonial */}
      <section className="bg-navy py-28 text-ivory">
        <Reveal className="container-gagrafa max-w-2xl">
          <p className="font-display text-2xl leading-relaxed text-ivory/90">
            {featuredReview?.comment
              ? `"${featuredReview.comment}"`
              : `"Quiet, well kept, and the staff handled everything before I had to
            ask. It felt less like a stay and more like having a second home in
            Accra."`}
          </p>
          <p className="mt-6 text-sm text-champagne">
            {featuredReview
              ? `${(featuredReview.bookings as any)?.guest_name ?? "Guest"} · ${featuredReview.rating}/5`
              : "Guest review, forthcoming"}
          </p>
        </Reveal>
      </section>

      {/* Location & contact */}
      <section className="container-gagrafa py-28">
        <div className="grid gap-12 md:grid-cols-2">
          <Reveal>
            <h2 className="text-3xl md:text-4xl">Find us</h2>
            <p className="mt-4 text-navy/70">{settings.address}</p>
            {(settings.contact_email || settings.contact_phone) && (
              <p className="mt-2 text-navy/70">
                {[settings.contact_email, settings.contact_phone].filter(Boolean).join(" · ")}
              </p>
            )}
          </Reveal>
          <div className="h-[280px] overflow-hidden rounded-xl border border-navy/10">
            <MapEmbed />
          </div>
        </div>
      </section>
    </div>
  );
}
