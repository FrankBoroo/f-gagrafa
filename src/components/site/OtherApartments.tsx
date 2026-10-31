import Image from "next/image";
import Link from "next/link";
import { coverImage, priceParts } from "@/lib/apartment-facts";
import type { PriceCurrency } from "@/lib/booking/pricing";
import type { Unit } from "@/lib/types";

export function OtherApartments({ units, currency }: { units: Unit[]; currency: PriceCurrency }) {
  if (!units.length) return null;
  return (
    <section className="bg-sand py-16 md:py-20">
      <div className="container-gagrafa">
        <h2 className="text-2xl font-normal md:text-3xl">Other apartments</h2>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
          {units.map((unit: Unit) => (
            <Link key={unit.id} href={`/units/${unit.slug}`} className="group block">
              <div className="relative aspect-[4/3] overflow-hidden bg-ivory">
                <Image
                  src={coverImage(unit)}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none"
                />
              </div>
              <p className="mt-3 text-sm text-navy">{unit.name}</p>
              <p className="text-sm text-navy/70">{priceParts(unit, currency)[0]}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
