import { createClient } from "@/lib/supabase/server";
import { ApartmentRow } from "@/components/site/ApartmentRow";
import type { Unit } from "@/lib/types";
import { getPublicSettings } from "@/lib/site-settings";
import { EmptyState } from "@/components/ui/EmptyState";
import { BedDouble } from "lucide-react";

export const metadata = { title: "Our apartments — The Gagrafa" };

export default async function UnitsPage() {
  const supabase = await createClient();
  const { pricing } = await getPublicSettings();
  const { data: units } = await supabase
    .from("units")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="container-gagrafa py-20 md:py-28">
      <p className="eyebrow">The Gagrafa</p>
      <h1 className="mt-4 text-4xl font-normal md:text-6xl">Our apartments</h1>

      <div className="mt-14 space-y-16 md:space-y-24">
        {(units as Unit[] | null)?.map((unit: Unit, i: number) => (
          <ApartmentRow key={unit.id} unit={unit} currency={pricing.currency} flip={i % 2 === 1} />
        ))}
      </div>

      {!units?.length && (
        <EmptyState
          icon={BedDouble}
          title="Our apartments are being prepared"
          description="New photos and details are on their way. Get in touch and we'll help you plan your stay."
          action={{ href: "/contact", label: "Contact us" }}
        />
      )}
    </div>
  );
}
