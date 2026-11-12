import { createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth";
import { RoomsManager } from "@/components/admin/RoomsManager";

export default async function AdminRoomsPage() {
  const supabase = createServiceClient();
  const [{ data: rooms }, { data: units }, { data: codes }, admin] = await Promise.all([
    supabase.from("rooms").select("id, number, unit_id, is_active, last_cleaned_at, units(name)").order("number"),
    supabase.from("units").select("id, name").order("sort_order"),
    supabase.from("room_access_codes").select("room_id, access_code"),
    isAdmin(),
  ]);
  const codeByRoom = new Map((codes ?? []).map((c: { room_id: string; access_code: string }) => [c.room_id, c.access_code]));

  return (
    <div>
      <h1 className="text-3xl">Rooms</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy/50">
        Guests book an apartment type; each booking is pencilled into one of these rooms. A room that is switched
        off is never offered. A door code is shown to a guest only once staff have confirmed their room. Airbnb links come with the Airbnb sync.
      </p>
      <div className="mt-8">
        <RoomsManager
          isAdmin={admin}
          units={units ?? []}
          rooms={(rooms ?? []).map((r: any) => ({
            id: r.id,
            number: r.number,
            unit_id: r.unit_id,
            unit_name: r.units?.name ?? "",
            is_active: r.is_active,
            last_cleaned_at: r.last_cleaned_at,
            door_code: codeByRoom.get(r.id) ?? "",
          }))}
        />
      </div>
    </div>
  );
}
