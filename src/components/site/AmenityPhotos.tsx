import Image from "next/image";
import { BUILDING_AMENITIES, ON_REQUEST } from "@/lib/property";

// The building's three real amenities as photos, for the homepage and every apartment page.
export function AmenityPhotos({ sizes = "(min-width: 768px) 33vw, 100vw" }: { sizes?: string }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {BUILDING_AMENITIES.map((a) => (
          <figure key={a.name}>
            <div className="relative aspect-[4/3] overflow-hidden bg-sand sm:aspect-[4/5]">
              <Image src={a.src} alt={a.alt} fill sizes={sizes} className="object-cover" />
            </div>
            <figcaption className="mt-3 font-display text-xl">{a.name}</figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-6 text-sm text-navy/70">On request: {ON_REQUEST.join(" · ").toLowerCase()}</p>
    </>
  );
}
