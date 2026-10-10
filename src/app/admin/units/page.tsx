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
        <span className="text-sm text-navy/50">{units?.length ?? 0} residences</span>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-navy/50">
        Edit price, capacity, and description inline. Deactivating a unit hides it from the
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
