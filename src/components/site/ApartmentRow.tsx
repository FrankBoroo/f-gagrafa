import Image from "next/image";
import Link from "next/link";
import { coverImage, priceParts, unitFacts } from "@/lib/apartment-facts";
import type { PriceCurrency } from "@/lib/booking/pricing";
import type { Unit } from "@/lib/types";

// One apartment type as a large photo beside its facts. `flip` puts the photo on the right.
export function ApartmentRow({ unit, currency, flip = false }: { unit: Unit; currency: PriceCurrency; flip?: boolean }) {
  return (
    <div className={`grid items-center gap-6 md:gap-12 ${flip ? "md:grid-cols-[1fr_1.4fr]" : "md:grid-cols-[1.4fr_1fr]"}`}>
      <Link
        href={`/units/${unit.slug}`}
        tabIndex={-1}
        aria-hidden="true"
        className={`group relative block aspect-[4/3] overflow-hidden bg-sand ${flip ? "md:order-2" : ""}`}
      >
        <Image
          src={coverImage(unit)}
          alt=""
          fill
          sizes="(min-width: 768px) 58vw, 100vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none"
        />
      </Link>
      <div className={flip ? "md:text-right" : ""}>
        <h3 className="text-3xl font-normal md:text-4xl">{unit.name}</h3>
        <p className="mt-3 text-sm text-navy/70">{unitFacts(unit).join(" · ")}</p>
        <p className="mt-2 text-base text-navy">{priceParts(unit, currency).join(" · ")}</p>
        <Link href={`/units/${unit.slug}`} aria-label={`Explore the ${unit.name}`} className="link-underline mt-6">
          Explore
        </Link>
      </div>
    </div>
  );
}
