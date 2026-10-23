import { createServiceClient } from "@/lib/supabase/server";
import { TourManager, type GalleryRow } from "@/components/admin/TourManager";

export default async function AdminTourPage() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("gallery_items")
    .select("*")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });

  return (
    <div>
      <h1 className="text-3xl">Tour</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy/50">
        The photos for the public Tour page: the property and the neighbourhood. Add captions and
        order them as you like.
      </p>

      {error ? (
        <p className="mt-8 max-w-xl rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The Tour table doesn&rsquo;t exist yet. Run <code>supabase/migration-tour-gallery.sql</code> in the
          Supabase SQL Editor, then reload this page.
        </p>
      ) : (
        <div className="mt-8">
          <TourManager initialItems={(data ?? []) as GalleryRow[]} />
        </div>
      )}
    </div>
  );
}
