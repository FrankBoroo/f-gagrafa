import { createServiceClient } from "@/lib/supabase/server";
import { ReviewCard } from "@/components/admin/ReviewCard";

export default async function AdminReviewsPage() {
  const supabase = createServiceClient();
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*, bookings(guest_name, booking_code)")
    .order("created_at", { ascending: false });

  const pending = reviews?.filter((r) => !r.is_published) ?? [];
  const published = reviews?.filter((r) => r.is_published) ?? [];

  return (
    <div>
      <h1 className="text-3xl">Reviews</h1>

      <h2 className="mt-8 text-lg text-navy/60">Pending ({pending.length})</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pending.map((r) => <ReviewCard key={r.id} review={r} />)}
        {!pending.length && <p className="text-sm text-navy/40">Nothing waiting for review.</p>}
      </div>

      <h2 className="mt-10 text-lg text-navy/60">Published ({published.length})</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {published.map((r) => <ReviewCard key={r.id} review={r} />)}
        {!published.length && <p className="text-sm text-navy/40">No published reviews yet.</p>}
      </div>
    </div>
  );
}
