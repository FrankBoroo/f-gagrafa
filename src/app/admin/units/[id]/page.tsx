import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth";
import { UnitForm, type UnitFormValues } from "@/components/admin/UnitForm";
import { UnitPhotoManager } from "@/components/admin/UnitPhotoManager";
import { DeleteUnitButton } from "@/components/admin/DeleteUnitButton";

export default async function EditUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: unit } = await supabase.from("units").select("*").eq("id", id).maybeSingle();
  if (!unit) notFound();

  // Door codes live in their own table; tolerate it not existing yet (migration not run).
  const { data: codeRow } = await supabase.from("unit_access_codes").select("access_code").eq("unit_id", id).maybeSingle();
  const admin = await isAdmin();

  const initial: UnitFormValues = {
    name: unit.name,
    type: unit.type,
    short_description: unit.short_description ?? "",
    description: unit.description ?? "",
    base_price_per_night: Number(unit.base_price_per_night),
    max_guests: unit.max_guests,
    bedrooms: unit.bedrooms,
    bathrooms: Number(unit.bathrooms),
    size_sqm: unit.size_sqm === null ? null : Number(unit.size_sqm),
    amenities: Array.isArray(unit.amenities) ? unit.amenities : [],
    access_code: codeRow?.access_code ?? "",
    is_active: unit.is_active,
  };

  return (
    <div>
      <Link href="/admin/units" className="text-sm text-navy/50 hover:text-navy">← All residences</Link>
      <h1 className="mt-3 text-3xl">{unit.name}</h1>
      <p className="mt-1 text-sm text-navy/50">/units/{unit.slug}</p>

      <div className="mt-8 grid max-w-5xl gap-8 lg:grid-cols-2">
        <UnitForm unitId={unit.id} initial={initial} />
        <div className="space-y-8">
          <UnitPhotoManager unitId={unit.id} images={Array.isArray(unit.images) ? unit.images : []} />
          {admin && (
            <div className="card p-6">
              <h2 className="text-lg">Delete</h2>
              <p className="mt-1 mb-4 text-sm text-navy/50">
                Only possible for a residence with no booking history. Otherwise switch it off above
                to hide it from the site.
              </p>
              <DeleteUnitButton unitId={unit.id} unitName={unit.name} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
