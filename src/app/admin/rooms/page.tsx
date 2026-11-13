import { createServiceClient } from "@/lib/supabase/server";
import { isAdmin, isStaff } from "@/lib/auth";
import { RoomsManager } from "@/components/admin/RoomsManager";
import { AirbnbSetup } from "@/components/admin/AirbnbSetup";
import { siteUrl } from "@/lib/env";

export default async function AdminRoomsPage() {
  // The page loads every door code with the service client, so check the role before any query.
  if (!(await isStaff())) {
    return (
      <div>
        <h1 className="text-3xl">Rooms</h1>
        <p className="mt-4 text-sm text-navy/50">Only staff can view rooms.</p>
      </div>
    );
  }

  const supabase = createServiceClient();
  const [{ data: rooms }, { data: units }, { data: codes }, admin] = await Promise.all([
    supabase.from("rooms").select("id, number, unit_id, is_active, last_cleaned_at, ical_export_token, airbnb_ical_url, airbnb_synced_at, airbnb_sync_error, units(name)").order("number"),
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
        off is never offered. A door code is shown to a guest only once staff have confirmed their room. Airbnb calendars are connected further down.
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
      <div className="mt-12">
        {/* The import link and the export token are secrets: only admins get them in the page. */}
        <AirbnbSetup
          isAdmin={admin}
          rooms={(rooms ?? []).map((r: any) => ({
            id: r.id,
            number: r.number,
            has_link: Boolean(r.airbnb_ical_url),
            synced_at: r.airbnb_synced_at,
            sync_error: r.airbnb_sync_error,
            import_url: admin ? r.airbnb_ical_url ?? "" : "",
            export_link: admin ? `${siteUrl()}/api/ical/${r.ical_export_token}` : "",
          }))}
        />
      </div>
    </div>
  );
}
