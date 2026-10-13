import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { UnitEditCard } from "@/components/admin/UnitEditCard";
import type { Unit } from "@/lib/types";

export default async function AdminUnitsPage() {
  const supabase = createServiceClient();
  const { data: units } = await supabase.from("units").select("*").order("sort_order");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl">Units</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-navy/50">{units?.length ?? 0} residences</span>
          <Link href="/admin/units/new" className="btn-primary px-5 py-2.5 text-sm">+ New residence</Link>
        </div>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-navy/50">
        Quick-edit price, capacity, and description here; open a residence for photos, amenities
        and its door code. Deactivating a unit hides it from the
        public site and booking flow immediately, without deleting anything.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(units as Unit[] | null)?.map((unit) => (
          <UnitEditCard key={unit.id} unit={unit} />
        ))}
      </div>
    </div>
  );
}
