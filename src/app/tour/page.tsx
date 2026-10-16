import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { TourGallery, type TourPhoto } from "@/components/site/TourGallery";

export const metadata = {
  title: "Tour — The Gagrafa",
  description: "A photo tour of The Gagrafa's residences, the building, and the Spintex neighbourhood around it.",
};

// Photos change when staff edit them, and the page is cheap to build.
export const dynamic = "force-dynamic";

const PHOTOS_PER_RESIDENCE = 4; // the full set lives on each residence's own page

export default async function TourPage() {
  const supabase = createServiceClient();

  const [{ data: units }, { data: gallery }] = await Promise.all([
    supabase.from("units").select("id, name, images").eq("is_active", true).order("sort_order"),
    // If the Tour table hasn't been created yet this just comes back empty.
    supabase.from("gallery_items").select("*").order("sort_order", { ascending: true }),
  ]);

  const residences: TourPhoto[] = (units ?? []).flatMap((u: any) =>
    ((u.images ?? []) as string[]).slice(0, PHOTOS_PER_RESIDENCE).map((src: string, i: number) => ({
      id: `${u.id}-${i}`,
      src,
      alt: `${u.name} — photo ${i + 1}`,
      caption: u.name as string,
      category: "residences" as const,
    }))
  );

  const fromGallery = (category: "property" | "neighbourhood"): TourPhoto[] =>
    (gallery ?? [])
      .filter((g: any) => g.category === category)
      .map((g: any) => ({
        id: g.id as string,
        src: g.image_url as string,
        alt: (g.caption as string | null) ?? (category === "property" ? "The Gagrafa property" : "The neighbourhood around The Gagrafa"),
        caption: (g.caption as string | null) ?? undefined,
        category,
      }));

  const photos: TourPhoto[] = [...residences, ...fromGallery("property"), ...fromGallery("neighbourhood")];

  return (
    <div className="container-gagrafa py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">Take a look</p>
      <h1 className="mt-3 text-4xl md:text-5xl">Tour</h1>
      <p className="mt-4 max-w-xl text-navy/60">
        Step inside our residences, explore the building, and see the neighbourhood around Spintex and
        Community 20.
      </p>

      <div className="mt-12">
        <TourGallery photos={photos} />
      </div>

      <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-navy/10 pt-8">
        <p className="text-navy/70">Like what you see?</p>
        <Link href="/booking" className="btn-primary">Book Your Stay</Link>
      </div>
    </div>
  );
}
