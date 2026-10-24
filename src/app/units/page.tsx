import { createClient } from "@/lib/supabase/server";
import { UnitCard } from "@/components/site/UnitCard";
import type { Unit } from "@/lib/types";
import { getPublicSettings } from "@/lib/site-settings";
import { EmptyState } from "@/components/ui/EmptyState";
import { BedDouble } from "lucide-react";

export const metadata = { title: "Residences — The Gagrafa" };

export default async function UnitsPage() {
  const supabase = await createClient();
  const { pricing } = await getPublicSettings();
  const { data: units } = await supabase
    .from("units")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="container-gagrafa py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">The Gagrafa</p>
      <h1 className="mt-4 text-4xl md:text-5xl">Residences</h1>
      <p className="mt-4 max-w-xl text-navy/60">
        From a compact studio to the signature penthouse — five residences, each
        furnished with the same quiet attention to detail.
      </p>

      <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {(units as Unit[] | null)?.map((unit) => (
          <UnitCard key={unit.id} unit={unit} currency={pricing.currency} />
        ))}
      </div>

      {!units?.length && (
        <EmptyState
          icon={BedDouble}
          title="Our residences are being prepared"
          description="New photos and details are on their way. Get in touch and we'll help you plan your stay."
          action={{ href: "/contact", label: "Contact us" }}
        />
      )}
    </div>
  );
}
