import Link from "next/link";
import Image from "next/image";
import { formatCurrency } from "@/lib/utils";
import type { Unit } from "@/lib/types";
import type { PriceCurrency } from "@/lib/booking/pricing";

export function UnitCard({ unit, currency = "GHS" }: { unit: Unit; currency?: PriceCurrency }) {
  return (
    <Link href={`/units/${unit.slug}`} className="card group block overflow-hidden">
      <div className="relative h-64 w-full overflow-hidden">
        <Image
          src={unit.images?.[0] ?? "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267"}
          alt={unit.name}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="p-6">
        <h3 className="text-xl">{unit.name}</h3>
        <p className="mt-1 text-sm text-navy/60">{unit.short_description}</p>
        <div className="mt-4 flex items-center justify-between text-sm text-navy/70">
          <span>{unit.max_guests} guests · {unit.bedrooms} bed · {unit.bathrooms} bath</span>
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-navy/10 pt-4">
          <span className="text-xs uppercase tracking-widest text-navy/50">From</span>
          <span className="text-lg text-navy">
            {formatCurrency(unit.base_price_per_night, currency)} <span className="text-sm text-navy/50">/ night</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
